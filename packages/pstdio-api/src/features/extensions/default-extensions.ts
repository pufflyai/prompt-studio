import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { readPackageManifest } from "pstdio-extensions";
import type { PruneProjectExtensionInstancesInput, SyncInstalledSourceInput } from "../../services/extension-service";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import {
  createSharedNamedSourceCheckout,
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
  isLocalExtensionSource,
  resolvePstdioHome,
} from "./install-extension-source";

export type DefaultExtensionEntry =
  | string
  | {
      force?: boolean;
      installName?: string;
      skipInstall?: boolean;
      source: string;
    };

export type DefaultExtensionsConfig = {
  defaultExtensions: DefaultExtensionEntry[];
};

export const defaultExtensions: DefaultExtensionsConfig = {
  defaultExtensions: [
    "pstdio-core-skills",
    "pstdio-core-templates",
    "pstdio-core-tickets",
    "pstdio-core-workspace-automations",
    "pstdio-core-worktree-automation",
  ],
};

const toConfig = (parsed: unknown): DefaultExtensionsConfig => {
  if (Array.isArray(parsed)) return { defaultExtensions: parsed as DefaultExtensionEntry[] };
  if (parsed && typeof parsed === "object" && "defaultExtensions" in parsed) {
    return {
      defaultExtensions: (parsed as { defaultExtensions: DefaultExtensionEntry[] }).defaultExtensions,
    };
  }
  throw new Error("PSTDIO_DEFAULT_EXTENSIONS must be a JSON array or object with defaultExtensions");
};

export const resolveDefaultExtensionsConfig = (env: Record<string, string | undefined> = process.env) => {
  const raw = env.PSTDIO_DEFAULT_EXTENSIONS;
  if (!raw) return defaultExtensions;

  try {
    return toConfig(JSON.parse(raw) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid PSTDIO_DEFAULT_EXTENSIONS JSON: ${error.message}`);
    }
    throw error;
  }
};

const toInstallInput = (entry: DefaultExtensionEntry): InstallExtensionSourceInput => {
  if (typeof entry === "string") return { source: entry };
  return {
    source: entry.source,
    installName: entry.installName,
    skipInstall: entry.skipInstall,
    force: entry.force,
  };
};

const sourceFor = (entry: DefaultExtensionEntry) => (typeof entry === "string" ? entry : entry.source);

const sourceModeDefaultEntry = (entry: DefaultExtensionEntry): DefaultExtensionEntry => {
  if (typeof entry !== "string") return entry;

  const localSource = join(import.meta.dirname, "../../../../../extensions", entry);
  if (!existsSync(localSource)) return entry;

  return { source: localSource, installName: entry, force: true };
};

type InstallDefaultExtensionsDeps = {
  config?: DefaultExtensionsConfig;
  env?: Record<string, string | undefined>;
  installExtensionSource?: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
};

type LoadScope = "user" | "repo";

const repoDefaultInstallName = (entry: DefaultExtensionEntry, sourcePath: string) => {
  if (typeof entry !== "string" && entry.installName) return entry.installName;
  return basename(sourcePath);
};

type ResolvedDefaultEntry = {
  entry: DefaultExtensionEntry;
  installName: string;
  scope: LoadScope;
};

const resolveLocalSource = (source: string) => {
  if (source.startsWith("~/")) return join(homedir(), source.slice(2));
  if (isAbsolute(source)) return source;
  return resolve(source);
};

const readDefaultScope = (sourcePath: string) => {
  const { manifest, diagnostics } = readPackageManifest(sourcePath);
  if (!manifest) {
    const first = diagnostics[0];
    throw new Error(first?.message ?? `Default extension validation failed: ${sourcePath}`);
  }
  return manifest.pstdio?.scope ?? "user";
};

const withResolvedDefaultEntries = async <T>(
  input: {
    config: DefaultExtensionsConfig;
    prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
    sourceMode?: boolean;
  },
  fn: (
    entries: ResolvedDefaultEntry[],
    prepareNamedSource: Awaited<ReturnType<typeof createSharedNamedSourceCheckout>>["prepareNamedSource"] | undefined,
  ) => Promise<T>,
) => {
  const entries = input.sourceMode
    ? input.config.defaultExtensions.map(sourceModeDefaultEntry)
    : input.config.defaultExtensions;
  const namedNames = entries.map(sourceFor).filter((source) => !isLocalExtensionSource(source));
  const prepareShared = input.prepareSharedCheckout ?? createSharedNamedSourceCheckout;
  const shared = namedNames.length > 0 ? await prepareShared(namedNames) : null;

  try {
    const resolved: ResolvedDefaultEntry[] = [];
    for (const entry of entries) {
      const source = sourceFor(entry);
      const sourcePath = isLocalExtensionSource(source)
        ? resolveLocalSource(source)
        : (await shared?.prepareNamedSource(source, ""))?.path;
      if (!sourcePath) continue;

      resolved.push({
        entry,
        installName: repoDefaultInstallName(entry, sourcePath),
        scope: readDefaultScope(sourcePath),
      });
    }

    return await fn(resolved, shared?.prepareNamedSource);
  } finally {
    shared?.cleanup();
  }
};

export const installDefaultExtensions = async (deps: InstallDefaultExtensionsDeps = {}) => {
  const config = deps.config ?? resolveDefaultExtensionsConfig(deps.env);
  const install = deps.installExtensionSource ?? installExtensionSource;
  const installed: InstalledExtensionSource[] = [];

  await withResolvedDefaultEntries(
    { config, prepareSharedCheckout: deps.prepareSharedCheckout, sourceMode: !deps.config },
    async (entries, prepareNamedSource) => {
      for (const resolved of entries) {
        if (resolved.scope !== "user") continue;
        installed.push(
          await install({
            ...toInstallInput(resolved.entry),
            existsOk: true,
            prepareNamedSource,
          }),
        );
      }
    },
  );

  return installed;
};

type InstallRepoDefaultExtensionsInput = {
  defaultExtensions: DefaultExtensionEntry[];
  repoPath: string;
  prepareSharedCheckout?: typeof createSharedNamedSourceCheckout;
};

export const installRepoDefaultExtensions = async (input: InstallRepoDefaultExtensionsInput) => {
  const materialized: string[] = [];
  const skipped: string[] = [];

  await withResolvedDefaultEntries(
    {
      config: { defaultExtensions: input.defaultExtensions },
      prepareSharedCheckout: input.prepareSharedCheckout,
      sourceMode: true,
    },
    async (entries, prepareNamedSource) => {
      for (const resolved of entries) {
        if (resolved.scope !== "repo") continue;

        const target = join(input.repoPath, ".pstdio", "extensions", resolved.installName);
        if (existsSync(target)) {
          skipped.push(resolved.installName);
          continue;
        }

        const installInput = toInstallInput(resolved.entry);
        await installExtensionSource({
          ...installInput,
          existsOk: true,
          force: false,
          prepareNamedSource,
          repoPath: input.repoPath,
        });
        materialized.push(resolved.installName);
      }
    },
  );

  return { materialized, skipped };
};

type InstalledExtensionDiscoveryDeps = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  extensionsRoot?: string;
  homedir?: () => string;
  loadExtension?: typeof loadExtensionSource;
  hashExtension?: typeof hashExtensionSource;
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
    } catch {
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

export const syncInstalledExtensionsForProject = async (deps: SyncInstalledExtensionsDeps) => {
  const snapshotStartedAt = new Date().toISOString();
  const { discovered, presentSourcePaths, root, rootExists } = await discoverInstalledExtensions(deps);
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
      snapshotStartedAt,
      sourcePathPrefix: root,
    });
    if (pruned && pruned.length > 0) {
      await deps.onProjectExtensionInstancesPruned?.({ projectId: deps.projectId, pruned });
    }
  }

  return synced;
};

export const syncInstalledExtensionsForProjects = async (deps: SyncInstalledExtensionsForProjectsDeps) => {
  const snapshotStartedAt = new Date().toISOString();
  const { discovered, presentSourcePaths, root, rootExists } = await discoverInstalledExtensions(deps);
  const synced: Array<{ installName: string; projectId: string }> = [];

  for (const project of await deps.projectService.list()) {
    for (const extension of discovered) {
      await deps.extensionService.syncInstalledSourceForProject({
        ...extension,
        projectId: project.id,
        sourceKind: "local_path",
      });
      synced.push({ installName: extension.installName, projectId: project.id });
    }
    if (rootExists) {
      const pruned = await deps.extensionService.pruneProjectExtensionInstances?.({
        activeSourcePaths: presentSourcePaths,
        projectId: project.id,
        snapshotStartedAt,
        sourcePathPrefix: root,
      });
      if (pruned && pruned.length > 0) {
        await deps.onProjectExtensionInstancesPruned?.({ projectId: project.id, pruned });
      }
    }
  }

  return synced;
};
