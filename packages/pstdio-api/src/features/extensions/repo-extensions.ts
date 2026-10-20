import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import type { createExtensionService, SyncInstalledSourceInput } from "../../services/extension-service";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";

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
  enabled: string[];
  missing: string[];
  skipped: string[];
};

const repoExtensionsRoot = (repoPath: string) => join(repoPath, ".pstdio", "extensions");

const listExtensionDirs = (root: string) => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

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

export const syncRepoExtensionsForProject = async (input: SyncRepoExtensionsForProjectInput) => {
  const root = repoExtensionsRoot(input.repoPath);
  const load = input.loadExtension ?? loadExtensionSource;
  const hash = input.hashExtension ?? hashExtensionSource;
  const conflicting: string[] = [];
  const enabled: string[] = [];
  const skipped: string[] = [];
  const presentSourcePaths = new Set<string>();
  const instances = await input.extensionService.listProjectExtensionInstances(input.projectId);
  const instancesBySourcePath = new Map(instances.map((record) => [record.installedSource.source_path, record]));
  const providedExtensionIds = new Set(
    instances.filter((record) => record.instance.enabled).map((record) => record.installedSource.extension_id),
  );

  for (const name of input.discover === false ? [] : listExtensionDirs(root)) {
    const sourcePath = join(root, name);

    let loaded: Awaited<ReturnType<typeof loadExtensionSource>>;
    try {
      loaded = await load(sourcePath);
    } catch {
      skipped.push(name);
      continue;
    }

    presentSourcePaths.add(sourcePath);
    const sourceInput = {
      displayName: loaded.metadata.displayName,
      extensionId: loaded.metadata.id,
      installName: name,
      manifest: loaded.manifest,
      name: loaded.metadata.name,
      projectId: input.projectId,
      sourceHash: hash(sourcePath),
      sourceKind: "local_path",
      sourcePath,
      version: loaded.metadata.version,
    } satisfies SyncInstalledSourceInput;
    const existing = instancesBySourcePath.get(sourcePath);
    const synced = await input.extensionService.syncInstalledSourceForProject(sourceInput);
    if (!synced) continue;
    if (existing) {
      if (existing.instance.enabled) enabled.push(name);
      continue;
    }

    // Discovery never takes an extension id away from a source the project already runs. A new
    // folder that claims one is registered disabled, and the extension panel is where a user
    // decides which copy provides it.
    if (providedExtensionIds.has(loaded.metadata.id)) {
      conflicting.push(name);
      continue;
    }

    await input.extensionService.setProjectExtensionEnabled(synced.instance.id, true);
    providedExtensionIds.add(loaded.metadata.id);
    enabled.push(name);
  }

  const missing = await markMissingSources(input, root, presentSourcePaths, instances);
  return { conflicting, enabled, missing, skipped };
};

export const syncRepoExtensionsForProjectFolder = async (input: SyncRepoExtensionsForProjectFolderInput) => {
  const workspace = await input.workspaceService.getDefault(input.projectId);
  if (!workspace?.root_path) return null;
  return syncRepoExtensionsForProject({ ...input, repoPath: workspace.root_path });
};
