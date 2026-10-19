import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { hashExtensionSource, type LoadedExtension } from "../features/extensions/extension-runtime";

export const activatePublishedExtension = async (input: {
  sources: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  instances: ReturnType<typeof createExtensionInstancesDBService>;
  projectId: string;
  instanceId?: string;
  enabled?: boolean;
  beforeActivate: () => Promise<void>;
  path: string;
  revision: string;
  loaded: LoadedExtension;
  refresh: (path?: string) => Promise<void>;
  emit: (source: unknown) => void;
  emitRemoved: (source: unknown) => void;
  emitInstance: (instance: unknown) => void;
}) => {
  const previousInstance = input.instanceId ? await input.instances.get(input.instanceId) : null;
  const previousSource = previousInstance ? await input.sources.get(previousInstance.installed_extension_id) : null;
  const values = {
    display_name: input.loaded.metadata.displayName,
    extension_id: input.loaded.metadata.id,
    manifest_json: input.loaded.manifest,
    source_hash: hashExtensionSource(input.path),
    loaded_revision: input.revision,
    source_kind: "registry" as const,
    source_path: input.path,
    source_ref: `pstdio-published:${input.revision}`,
    status: "loaded" as const,
    version: input.loaded.metadata.version,
    last_loaded_at: new Date().toISOString(),
    last_error_json: null,
  };
  // Validate and build an isolated source before a single transaction switches
  // this project's instance. Other projects may still use the local source.
  const updated = await input.sources.register({ ...values, install_name: input.loaded.metadata.name });
  if (!updated) throw new Error("Published extension registration failed");
  let current = updated;
  try {
    await input.refresh(input.path);
    const refreshed = await input.sources.get(updated.id);
    if (!refreshed) throw new Error("Published extension registration disappeared");
    current = refreshed;
    if (current.status === "error") throw new Error("Published extension activation failed");
  } catch (error) {
    await input.sources.remove(updated.id);
    await input.refresh().catch(() => {});
    throw error;
  }
  let activated: Awaited<ReturnType<typeof input.instances.activateProjectSource>>;
  try {
    await input.beforeActivate();
    activated = await input.instances.activateProjectSource({
      projectId: input.projectId,
      extensionId: values.extension_id,
      instanceId: input.instanceId,
      expectedSourceId: previousInstance?.installed_extension_id,
      installedSourceId: updated.id,
      enabled: input.enabled,
    });
  } catch (error) {
    await input.sources.remove(updated.id);
    throw error;
  }
  input.emit(current);
  for (const instance of activated.changed) input.emitInstance(instance);
  if (
    previousInstance &&
    previousSource?.source_ref?.startsWith("pstdio-published:") &&
    !(await input.instances.list({ installed_extension_id: previousInstance.installed_extension_id })).length
  ) {
    await input.sources.remove(previousInstance.installed_extension_id);
    input.emitRemoved(previousSource);
  }
  return { installedSource: current, instance: activated.instance };
};
