import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { createInstalledExtensionSourcesDBService } from "pstdio-db";
import type { createExtensionService, SyncInstalledSourceInput } from "../../services/extension-service";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";

type ExtensionService = Pick<
  ReturnType<typeof createExtensionService>,
  | "enableInstalledSourceForProject"
  | "listProjectExtensionInstances"
  | "setProjectExtensionEnabled"
  | "syncInstalledSourceForProject"
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

type SyncRepoExtensionsForLinkedReposInput = Omit<SyncRepoExtensionsForProjectInput, "repoPath"> & {
  repoService: {
    listByProject: (projectId: string) => Promise<Array<{ path: string }>>;
  };
};

export type SyncRepoExtensionsResult = {
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

export const syncRepoExtensionsForProject = async (input: SyncRepoExtensionsForProjectInput) => {
  const root = repoExtensionsRoot(input.repoPath);
  const load = input.loadExtension ?? loadExtensionSource;
  const hash = input.hashExtension ?? hashExtensionSource;
  const enabled: string[] = [];
  const skipped: string[] = [];
  const presentSourcePaths = new Set<string>();
  const instances = await input.extensionService.listProjectExtensionInstances(input.projectId);
  const instancesBySourcePath = new Map(instances.map((record) => [record.installedSource.source_path, record]));

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
    if (existing) {
      await input.extensionService.syncInstalledSourceForProject(sourceInput);
    } else {
      await input.extensionService.enableInstalledSourceForProject(sourceInput);
    }
    if (!existing || existing.instance.enabled) enabled.push(name);
  }

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

  return { enabled, missing, skipped };
};

export const syncRepoExtensionsForLinkedRepos = async (input: SyncRepoExtensionsForLinkedReposInput) => {
  const repos = await input.repoService.listByProject(input.projectId);
  const results = [];

  for (const repo of [...repos].sort((left, right) => left.path.localeCompare(right.path))) {
    results.push(await syncRepoExtensionsForProject({ ...input, repoPath: repo.path }));
  }

  return results;
};
