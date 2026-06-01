import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PruneProjectExtensionInstancesInput, SyncInstalledSourceInput } from "../../services/extension-service";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import { resolvePstdioHome } from "./install-extension-source";

type InstalledExtensionDiscoveryDeps = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  extensionsRoot?: string;
  homedir?: () => string;
  loadExtension?: typeof loadExtensionSource;
  hashExtension?: typeof hashExtensionSource;
  onLoadFailure?: (failure: { error: unknown; installName: string; sourcePath: string }) => void;
};

type SyncInstalledExtensionsDeps = InstalledExtensionDiscoveryDeps & {
  extensionService: {
    pruneProjectExtensionInstances?: (input: PruneProjectExtensionInstancesInput) => Promise<PrunedExtensionInstance[]>;
    syncInstalledSourceForProject: (input: SyncInstalledSourceInput) => Promise<unknown>;
  };
  onProjectExtensionInstancesPruned?: (input: {
    projectId: string;
    pruned: PrunedExtensionInstance[];
  }) => Promise<void>;
  projectId: string;
};

type SyncInstalledExtensionsForProjectsDeps = InstalledExtensionDiscoveryDeps & {
  extensionService: {
    pruneProjectExtensionInstances?: (input: PruneProjectExtensionInstancesInput) => Promise<PrunedExtensionInstance[]>;
    syncInstalledSourceForProject: (input: SyncInstalledSourceInput) => Promise<unknown>;
  };
  onProjectExtensionInstancesPruned?: (input: {
    projectId: string;
    pruned: PrunedExtensionInstance[];
  }) => Promise<void>;
  projectService: {
    list: () => Promise<Array<{ id: string }>>;
  };
};

type DiscoveredInstalledExtension = Omit<SyncInstalledSourceInput, "projectId">;

type PrunedExtensionInstance = {
  installedSource: { extension_id: string; manifest_json: unknown };
};

const discoverInstalledExtensions = async (deps: InstalledExtensionDiscoveryDeps) => {
  const root = deps.extensionsRoot ?? join(resolvePstdioHome({ env: deps.env, homedir: deps.homedir }), "extensions");
  if (!existsSync(root)) return { discovered: [], presentSourcePaths: [], root, rootExists: false };

  const load = deps.loadExtension ?? loadExtensionSource;
  const hash = deps.hashExtension ?? hashExtensionSource;
  const discovered: DiscoveredInstalledExtension[] = [];
  const presentSourcePaths: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const sourcePath = join(root, entry.name);
    presentSourcePaths.push(sourcePath);

    let loaded: Awaited<ReturnType<typeof loadExtensionSource>>;
    try {
      loaded = await load(sourcePath);
    } catch (error) {
      deps.onLoadFailure?.({ error, installName: entry.name, sourcePath });
      // User-edited installed sources can become invalid; project creation should still sync healthy extensions.
      continue;
    }

    discovered.push({
      installName: entry.name,
      displayName: loaded.metadata.displayName,
      extensionId: loaded.metadata.id,
      manifest: loaded.manifest,
      name: loaded.metadata.name,
      sourceHash: hash(sourcePath),
      sourcePath,
      version: loaded.metadata.version,
    });
  }

  return { discovered, presentSourcePaths, root, rootExists: true };
};

type InstalledExtensionSnapshot = Awaited<ReturnType<typeof discoverInstalledExtensions>>;

const syncSnapshotForProject = async (
  deps: Pick<SyncInstalledExtensionsDeps, "extensionService" | "onProjectExtensionInstancesPruned" | "projectId"> & {
    snapshot: InstalledExtensionSnapshot;
    snapshotStartedAt: string;
  },
) => {
  const { discovered, presentSourcePaths, root, rootExists } = deps.snapshot;
  const synced: string[] = [];

  for (const extension of discovered) {
    await deps.extensionService.syncInstalledSourceForProject({
      ...extension,
      projectId: deps.projectId,
      sourceKind: "local_path",
    });
    synced.push(extension.installName);
  }

  if (rootExists) {
    const pruned = await deps.extensionService.pruneProjectExtensionInstances?.({
      activeSourcePaths: presentSourcePaths,
      projectId: deps.projectId,
      snapshotStartedAt: deps.snapshotStartedAt,
      sourcePathPrefix: root,
    });
    if (pruned && pruned.length > 0) {
      await deps.onProjectExtensionInstancesPruned?.({ projectId: deps.projectId, pruned });
    }
  }

  return synced;
};

export const syncInstalledExtensionsForProject = async (deps: SyncInstalledExtensionsDeps) => {
  const snapshotStartedAt = new Date().toISOString();
  const snapshot = await discoverInstalledExtensions(deps);

  return syncSnapshotForProject({ ...deps, snapshot, snapshotStartedAt });
};

export const syncInstalledExtensionsForProjects = async (deps: SyncInstalledExtensionsForProjectsDeps) => {
  const snapshotStartedAt = new Date().toISOString();
  const snapshot = await discoverInstalledExtensions(deps);
  const synced: Array<{ installName: string; projectId: string }> = [];

  for (const project of await deps.projectService.list()) {
    const projectSynced = await syncSnapshotForProject({
      ...deps,
      projectId: project.id,
      snapshot,
      snapshotStartedAt,
    });
    synced.push(...projectSynced.map((installName) => ({ installName, projectId: project.id })));
  }

  return synced;
};
