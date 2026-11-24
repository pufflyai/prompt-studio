import { basename, join } from "node:path";
import { getExtensionApiVersionError } from "pstdio-extensions";
import {
  ProjectNotFoundError,
  type PruneProjectExtensionInstancesInput,
  type SyncInstalledSourceInput,
} from "../../services/extension-service";
import { listExtensionSources } from "./discover-extension-sources";
import {
  type hashExtensionSource,
  hashExtensionSourceAsync,
  loadExtensionSource,
  readExtensionSourceMetadata,
} from "./extension-runtime";
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

export type SyncedInstalledExtension = {
  installName: string;
  sourceHash: string | null;
};

type PrunedExtensionInstance = {
  installedSource: { extension_id: string; manifest_json: unknown };
};

const discoverInstalledExtensions = async (deps: InstalledExtensionDiscoveryDeps) => {
  const root = deps.extensionsRoot ?? join(resolvePstdioHome({ env: deps.env, homedir: deps.homedir }), "extensions");
  const listing = await listExtensionSources(root);
  if (!listing.rootExists) return { discovered: [], presentSourcePaths: [], root, rootExists: false };

  const load = deps.loadExtension ?? ((path: string) => loadExtensionSource(path, { accepted: true }));
  const hash = deps.hashExtension ?? hashExtensionSourceAsync;
  const discovered = new Array<DiscoveredInstalledExtension | undefined>(listing.paths.length);
  let combinedWorkspaces = false;
  let next = 0;
  let failure: { index: number; error: unknown } | undefined;

  const read = async (sourcePath: string): Promise<DiscoveredInstalledExtension | undefined> => {
    const installName = basename(sourcePath);
    let loaded: Awaited<ReturnType<typeof loadExtensionSource>>;
    try {
      loaded = await load(sourcePath);
    } catch (error) {
      try {
        const metadataOnly = readExtensionSourceMetadata(sourcePath);
        if (!getExtensionApiVersionError(metadataOnly.metadata.name, metadataOnly.metadata.enginesPstdio)) throw error;
        loaded = metadataOnly;
      } catch {
        deps.onLoadFailure?.({ error, installName, sourcePath });
        // User-edited installed sources can become invalid; project creation should still sync healthy extensions.
        return;
      }
    }
    if (
      loaded.metadata.id === "pstdio.workspaces" &&
      "definition" in loaded &&
      Array.isArray(loaded.definition.workspaceTypes) &&
      loaded.definition.workspaceTypes.some(
        (provider) => typeof provider === "object" && provider !== null && "id" in provider && provider.id === "git",
      )
    )
      combinedWorkspaces = true;
    return {
      installName,
      displayName: loaded.metadata.displayName,
      extensionId: loaded.metadata.id,
      manifest: loaded.manifest,
      name: loaded.metadata.name,
      sourceHash: await hash(sourcePath),
      sourcePath,
      version: loaded.metadata.version,
    };
  };
  const fail = (index: number, error: unknown) => {
    if (!failure || index < failure.index) failure = { index, error };
  };
  const inspect = async () => {
    while (!failure && next < listing.paths.length) {
      const index = next++;
      try {
        discovered[index] = await read(listing.paths[index]!);
      } catch (error) {
        fail(index, error);
      }
    }
  };
  // Independent fresh reads may overlap, while registration retains disk order.
  // Drain admitted reads on failure before callers can tear down their source folders.
  await Promise.all(Array.from({ length: Math.min(2, listing.paths.length) }, inspect));
  if (failure) throw failure.error;
  const healthy = discovered.filter((extension): extension is DiscoveredInstalledExtension => extension !== undefined);

  return {
    discovered: combinedWorkspaces
      ? healthy.filter(({ extensionId }) => extensionId !== "pstdio.git-workspaces")
      : healthy,
    presentSourcePaths: healthy.map((extension) => extension.sourcePath),
    root,
    rootExists: true,
  };
};

type InstalledExtensionSnapshot = Awaited<ReturnType<typeof discoverInstalledExtensions>>;

const syncSnapshotForProject = async (
  deps: Pick<SyncInstalledExtensionsDeps, "extensionService" | "onProjectExtensionInstancesPruned" | "projectId"> & {
    snapshot: InstalledExtensionSnapshot;
    snapshotStartedAt: string;
  },
) => {
  const { discovered, presentSourcePaths, root, rootExists } = deps.snapshot;
  const synced: SyncedInstalledExtension[] = [];

  for (const extension of discovered) {
    const result = await deps.extensionService.syncInstalledSourceForProject({
      ...extension,
      projectId: deps.projectId,
    });
    if (result === null) continue;
    // The hash of the folder as it is on disk, which the caller compares against the adopted hash.
    synced.push({ installName: extension.installName, sourceHash: extension.sourceHash ?? null });
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
  const projects = await deps.projectService.list();
  const synced: Array<Array<SyncedInstalledExtension & { projectId: string }>> = [];
  let next = 0;
  const sync = async () => {
    while (next < projects.length) {
      const index = next++;
      const projectId = projects[index]!.id;
      try {
        const projectSynced = await syncSnapshotForProject({ ...deps, projectId, snapshot, snapshotStartedAt });
        synced[index] = projectSynced.map((entry) => ({ ...entry, projectId }));
      } catch (error) {
        if (!(error instanceof ProjectNotFoundError) || error.projectId !== projectId) throw error;
      }
    }
  };
  // A project's frontend refresh must not hold every other project's disabled
  // registration behind it. Bound admission and drain work before returning.
  const results = await Promise.allSettled(Array.from({ length: Math.min(2, projects.length) }, sync));
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (failures.length) throw new AggregateError(failures, "Installed extension discovery failed");
  return synced.flat();
};
