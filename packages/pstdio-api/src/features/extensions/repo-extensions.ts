import { basename, join } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import type { createExtensionService, SyncInstalledSourceInput } from "../../services/extension-service";
import { AlwaysEnabledExtensionError } from "./always-on-extensions";
import { listExtensionSources } from "./discover-extension-sources";
import {
  type hashExtensionSource,
  hashExtensionSourceAsync,
  loadExtensionSource,
  readExtensionSourceMetadata,
} from "./extension-runtime";

type ExtensionService = Pick<
  ReturnType<typeof createExtensionService>,
  "listProjectExtensionInstances" | "setProjectExtensionEnabled" | "syncInstalledSourceForProject"
>;

type InstalledSourcesService = Pick<
  ReturnType<typeof createInstalledExtensionSourcesDBService>,
  "get" | "listBySourcePathPrefix" | "markStatus"
>;

type SyncRepoExtensionsForProjectInput = {
  discover?: boolean;
  /**
   * Which newly discovered folders to enable. Omit it to enable every new folder. A folder
   * restored from another device is registered disabled, so its code runs only after a
   * person enables it.
   */
  enable?: (name: string) => boolean;
  extensionService: ExtensionService;
  hashExtension?: typeof hashExtensionSource;
  installedExtensionSourcesService: InstalledSourcesService;
  loadExtension?: typeof loadExtensionSource;
  projectId: string;
  repoPath: string;
};

type SyncRepoExtensionsForProjectFolderInput = Omit<SyncRepoExtensionsForProjectInput, "repoPath"> & {
  workspaceService: { getDefault(projectId: string): Promise<{ root_path: string | null } | null> };
};

export type SyncRepoExtensionsResult = {
  /** Folders another enabled source already provides. They are registered, but left disabled. */
  conflicting: string[];
  /** New folders the caller chose not to enable. They are registered, but left disabled. */
  disabled: string[];
  enabled: string[];
  missing: string[];
  skipped: string[];
};

const repoExtensionsRoot = (repoPath: string) => join(repoPath, ".pstdio", "extensions");

const markMissingSources = async (
  input: SyncRepoExtensionsForProjectInput,
  root: string,
  presentSourcePaths: Set<string>,
  instances: Awaited<ReturnType<ExtensionService["listProjectExtensionInstances"]>>,
) => {
  const missing: string[] = [];
  const sources = await input.installedExtensionSourcesService.listBySourcePathPrefix(root);
  for (const source of sources) {
    if (presentSourcePaths.has(source.source_path)) continue;
    const updated = await input.installedExtensionSourcesService.markStatus(source.id, "missing");
    const instance = instances.find((record) => record.installedSource.id === source.id);
    if (instance?.instance.enabled) {
      await input.extensionService.setProjectExtensionEnabled(instance.instance.id, false);
    }
    missing.push(updated?.install_name ?? source.install_name);
  }
  return missing;
};

// A host-required copy can provide the extension id even when it was enabled after the snapshot.
const enableUnlessRequiredElsewhere = async (extensionService: ExtensionService, instanceId: string) => {
  try {
    await extensionService.setProjectExtensionEnabled(instanceId, true);
    return true;
  } catch (error) {
    if (error instanceof AlwaysEnabledExtensionError) return false;
    throw error;
  }
};

/** Only a new folder can be kept off; an existing registration keeps its state. */
const keepsOff = (input: Pick<SyncRepoExtensionsForProjectInput, "enable">, name: string, existing: unknown) =>
  !existing && !!input.enable && !input.enable(name);

/** A folder that stays off is read from its manifest only, so its code is never imported. */
const readRepoExtension = async (sourcePath: string, manifestOnly: boolean, load: typeof loadExtensionSource) => {
  try {
    return manifestOnly ? readExtensionSourceMetadata(sourcePath) : await load(sourcePath);
  } catch {
    return null;
  }
};

const sourceInputFor = (
  loaded: Awaited<ReturnType<typeof loadExtensionSource>>,
  source: { name: string; projectId: string; sourceHash: string; sourcePath: string },
) =>
  ({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName: source.name,
    manifest: loaded.manifest,
    name: loaded.metadata.name,
    projectId: source.projectId,
    sourceHash: source.sourceHash,
    sourceKind: "local_path",
    sourcePath: source.sourcePath,
    version: loaded.metadata.version,
  }) satisfies SyncInstalledSourceInput;

export const syncRepoExtensionsForProject = async (input: SyncRepoExtensionsForProjectInput) => {
  const root = repoExtensionsRoot(input.repoPath);
  const load = input.loadExtension ?? ((path: string) => loadExtensionSource(path, { accepted: true }));
  const hash = input.hashExtension ?? hashExtensionSourceAsync;
  const conflicting: string[] = [];
  const disabled: string[] = [];
  const enabled: string[] = [];
  const skipped: string[] = [];
  const presentSourcePaths = new Set<string>();
  const instances = await input.extensionService.listProjectExtensionInstances(input.projectId);
  const instancesBySourcePath = new Map(instances.map((record) => [record.installedSource.source_path, record]));
  const providedExtensionIds = new Set(
    instances.filter((record) => record.instance.enabled).map((record) => record.installedSource.extension_id),
  );

  const paths = input.discover === false ? [] : (await listExtensionSources(root)).paths;
  for (const path of paths) {
    const name = basename(path);
    const sourcePath = join(root, name);
    const existing = instancesBySourcePath.get(sourcePath);
    const register = keepsOff(input, name, existing);

    const loaded = await readRepoExtension(sourcePath, register, load);
    if (!loaded) {
      skipped.push(name);
      continue;
    }

    presentSourcePaths.add(sourcePath);
    const synced = await input.extensionService.syncInstalledSourceForProject(
      sourceInputFor(loaded, { name, projectId: input.projectId, sourceHash: await hash(sourcePath), sourcePath }),
    );
    if (!synced) continue;
    if (existing) {
      enabled.push(...(existing.instance.enabled ? [name] : []));
      continue;
    }

    // Discovery never takes an extension id away from a source the project already runs. A new
    // folder that claims one is registered disabled, and the extension panel is where a user
    // decides which copy provides it.
    if (providedExtensionIds.has(loaded.metadata.id)) {
      conflicting.push(name);
      continue;
    }
    if (register) {
      disabled.push(name);
      continue;
    }
    if (!(await enableUnlessRequiredElsewhere(input.extensionService, synced.instance.id))) {
      conflicting.push(name);
      continue;
    }
    providedExtensionIds.add(loaded.metadata.id);
    enabled.push(name);
  }

  const missing = await markMissingSources(input, root, presentSourcePaths, instances);
  return { conflicting, disabled, enabled, missing, skipped };
};

export const syncRepoExtensionsForProjectFolder = async (input: SyncRepoExtensionsForProjectFolderInput) => {
  const workspace = await input.workspaceService.getDefault(input.projectId);
  if (!workspace?.root_path) return null;
  return syncRepoExtensionsForProject({ ...input, repoPath: workspace.root_path });
};
