import { basename, join } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import { readAcceptedRevision } from "pstdio-extensions";
import type { createExtensionService, SyncInstalledSourceInput } from "../../services/extension-service";
import { AlwaysEnabledExtensionError } from "./always-on-extensions";
import { listExtensionSources } from "./discover-extension-sources";
import {
  type hashExtensionSource,
  hashExtensionSourceAsync,
  loadExtensionSource,
  readExtensionSourceMetadata,
} from "./extension-runtime";
import { type RepoExtensionWorkspace, readyRepoExtensionFolder } from "./repo-extension-roots";

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
  workspaceService: { getDefault(projectId: string): Promise<RepoExtensionWorkspace | null> };
};

export type SyncRepoExtensionsResult = {
  /** Folders whose extension is already installed from another source. */
  conflicting: string[];
  /** New folders the caller chose not to enable. They are registered, but left disabled. */
  disabled: string[];
  enabled: string[];
  missing: string[];
  newlyMissing: string[];
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
  const newlyMissing: string[] = [];
  const sources = await input.installedExtensionSourcesService.listBySourcePathPrefix(root);
  for (const source of sources) {
    if (presentSourcePaths.has(source.source_path)) continue;
    if (source.status !== "missing") {
      const updated = await input.installedExtensionSourcesService.markStatus(source.id, "missing");
      if (updated) newlyMissing.push(updated.install_name);
    }
    const instance = instances.find((record) => record.installedSource.id === source.id);
    if (instance?.instance.enabled) {
      await input.extensionService.setProjectExtensionEnabled(instance.instance.id, false);
    }
    missing.push(source.install_name);
  }
  return { missing, newlyMissing };
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
    if (!manifestOnly) return await load(sourcePath);
    const accepted = await readAcceptedRevision(sourcePath);
    return readExtensionSourceMetadata(accepted?.packagePath ?? sourcePath);
  } catch {
    return null;
  }
};

const sourceInputFor = (
  loaded: Awaited<ReturnType<typeof loadExtensionSource>>,
  source: { name: string; projectId: string; sourceHash: string; sourcePath: string },
  existing?: Awaited<ReturnType<ExtensionService["listProjectExtensionInstances"]>>[number],
) =>
  ({
    displayName: loaded.metadata.displayName,
    extensionId: loaded.metadata.id,
    installName: source.name,
    manifest:
      existing?.instance.enabled === false && existing.installedSource.source_hash === source.sourceHash
        ? existing.installedSource.manifest_json
        : loaded.manifest,
    name: loaded.metadata.name,
    projectId: source.projectId,
    sourceHash: source.sourceHash,
    sourceKind: existing?.installedSource.source_kind ?? "local_path",
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

  const paths = input.discover === false ? [] : (await listExtensionSources(root)).paths;
  for (const path of paths) {
    const name = basename(path);
    const sourcePath = join(root, name);
    const existing = instancesBySourcePath.get(sourcePath);
    const register = keepsOff(input, name, existing);

    const loaded = await readRepoExtension(sourcePath, register || existing?.instance.enabled === false, load);
    if (!loaded) {
      skipped.push(name);
      continue;
    }

    presentSourcePaths.add(sourcePath);
    const sourceHash = await hash(sourcePath);
    const source = sourceInputFor(loaded, { name, projectId: input.projectId, sourceHash, sourcePath }, existing);
    const synced = await input.extensionService.syncInstalledSourceForProject(source);
    if (!synced) {
      conflicting.push(name);
      continue;
    }
    if (existing) {
      enabled.push(...(existing.instance.enabled ? [name] : []));
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
    enabled.push(name);
  }

  const { missing, newlyMissing } = await markMissingSources(input, root, presentSourcePaths, instances);
  return { conflicting, disabled, enabled, missing, newlyMissing, skipped };
};

export const syncRepoExtensionsForProjectFolder = async (input: SyncRepoExtensionsForProjectFolderInput) => {
  const repoPath = readyRepoExtensionFolder(await input.workspaceService.getDefault(input.projectId));
  return repoPath ? syncRepoExtensionsForProject({ ...input, repoPath }) : null;
};
