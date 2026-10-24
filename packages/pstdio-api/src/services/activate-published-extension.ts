import { rm } from "node:fs/promises";
import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { hashExtensionSource, type LoadedExtension } from "../features/extensions/extension-runtime";

interface Activation {
  projectId: string;
  instanceId?: string;
  enabled: boolean;
  /** Adoption replaces a private override, whose folder may hold the only copy of local edits. */
  keepReplacedFolder?: boolean;
  beforeActivate: () => Promise<void>;
  source:
    | { kind: "prepared"; path: string; revision: string; loaded: LoadedExtension }
    | { kind: "existing"; id: string };
}
interface ActivationDeps {
  sources: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  instances: ReturnType<typeof createExtensionInstancesDBService>;
  refresh: (path?: string) => Promise<void>;
  emit: (source: unknown) => void;
  emitRemoved: (source: unknown) => void;
  emitInstance: (instance: unknown) => void;
}

type RegisteredActivation = {
  input: Activation;
  registered: NonNullable<Awaited<ReturnType<ActivationDeps["sources"]["get"]>>>;
  previousInstance: Awaited<ReturnType<ActivationDeps["instances"]["get"]>> | null;
  previousSource: Awaited<ReturnType<ActivationDeps["sources"]["get"]>> | null;
};
const registerActivation = async (deps: ActivationDeps, input: Activation) => {
  const previousInstance = input.instanceId ? await deps.instances.get(input.instanceId) : null;
  const previousSource = previousInstance ? await deps.sources.get(previousInstance.installed_extension_id) : null;
  const source = input.source;
  const registered =
    source.kind === "existing"
      ? await deps.sources.get(source.id)
      : await deps.sources.register({
          display_name: source.loaded.metadata.displayName,
          extension_id: source.loaded.metadata.id,
          manifest_json: source.loaded.manifest,
          source_hash: hashExtensionSource(source.path),
          loaded_revision: source.revision,
          source_kind: "registry",
          source_path: source.path,
          source_ref: `pstdio-published:${source.revision}`,
          status: "loaded",
          version: source.loaded.metadata.version,
          last_loaded_at: new Date().toISOString(),
          last_error_json: null,
          install_name: source.loaded.metadata.name,
        });
  if (!registered) throw new Error("Published source disappeared");

  return { input, registered, previousInstance, previousSource };
};
const refreshActivation = async (deps: ActivationDeps, { input, registered }: RegisteredActivation) => {
  if (input.source.kind === "existing") return;
  await deps.refresh(input.source.path);
  const current = await deps.sources.get(registered.id);
  if (!current || current.status === "error") throw new Error("Published extension activation failed");
  Object.assign(registered, current);
};

/** Prepare every source before one database transaction changes the project's running set. */
export const activatePublishedExtensions = async (deps: ActivationDeps, inputs: Activation[]) => {
  const prepared: RegisteredActivation[] = [];
  try {
    for (const input of inputs) {
      const entry = await registerActivation(deps, input);
      prepared.push(entry);
      await refreshActivation(deps, entry);
    }
    for (const { input } of prepared) await input.beforeActivate();
    const activated = await deps.instances.activateProjectSources(
      prepared.map(({ input, registered, previousInstance }) => ({
        projectId: input.projectId,
        extensionId: registered.extension_id,
        instanceId: input.instanceId,
        expectedSourceId: previousInstance?.installed_extension_id,
        installedSourceId: registered.id,
        enabled: input.enabled,
      })),
    );
    for (const [index, entry] of prepared.entries()) {
      deps.emit(entry.registered);
      for (const instance of activated[index]!.changed) deps.emitInstance(instance);
      if (
        entry.previousSource?.id !== entry.registered.id &&
        entry.previousSource?.source_ref?.startsWith("pstdio-published:") &&
        !(await deps.instances.list({ installed_extension_id: entry.previousSource.id })).length
      ) {
        await deps.sources.remove(entry.previousSource.id);
        // Each revision is unpacked into its own folder, which nothing uses once its row is gone.
        if (!entry.input.keepReplacedFolder)
          await rm(entry.previousSource.source_path, { recursive: true, force: true });
        deps.emitRemoved(entry.previousSource);
      }
    }
    return activated.map((result, index) => ({
      installedSource: prepared[index]!.registered,
      instance: result.instance,
    }));
  } catch (error) {
    // A source referenced by an instance has crossed the activation boundary and must stay usable.
    for (const { registered } of prepared)
      if (!(await deps.instances.list({ installed_extension_id: registered.id })).length)
        await deps.sources.remove(registered.id);
    await deps.refresh().catch(() => {});
    throw error;
  }
};
