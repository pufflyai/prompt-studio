import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type ExtensionRuntime,
  type LoadedExtensionSource,
  loadExtensionSources,
  normalizeExtensionSources,
} from "pstdio-extensions";
import type { createExtensionService } from "../../services/extension-service";
import type { createRepoService } from "../../services/repo-service";

type EnabledExtensionSource = Awaited<
  ReturnType<ReturnType<typeof createExtensionService>["listEnabledSourcesForProject"]>
>[number];

type CachedSource = {
  diagnostics: Awaited<ReturnType<typeof loadExtensionSources>>["diagnostics"];
  source: LoadedExtensionSource;
};

export type ProjectExtensionRuntimeSnapshot = {
  enabledSources: EnabledExtensionSource[];
  runtime: ExtensionRuntime;
};

// Attributes a normalized runtime record back to the enabled source that produced it.
// The record's sourcePath is the extension entry file, so the longest source_path that
// contains it is the owner. This keeps repo-local override attribution consistent with
// normalizeExtensionSources(), which selects one source per extension id.
export const resolveEnabledSourceForRecord = (
  recordSourcePath: string,
  enabledSources: ProjectExtensionRuntimeSnapshot["enabledSources"],
) => {
  const normalizedRecordSourcePath = recordSourcePath.replaceAll("\\", "/");
  let match: EnabledExtensionSource | undefined;
  let matchLength = -1;

  for (const source of enabledSources) {
    const root = source.installedSource.source_path.replaceAll("\\", "/");
    const prefix = root.endsWith("/") ? root : `${root}/`;
    if (!normalizedRecordSourcePath.startsWith(prefix) || root.length <= matchLength) continue;
    match = source;
    matchLength = root.length;
  }

  return match;
};

export type ProjectExtensionRuntimeCatalog = ReturnType<typeof createProjectExtensionRuntimeCatalog>;

export const createProjectExtensionRuntimeCatalog = (deps: {
  extensionService: ReturnType<typeof createExtensionService>;
  repoService: ReturnType<typeof createRepoService>;
}) => {
  // Caches the in-flight load promise so concurrent catalog reads (for example a template
  // list and a skill list on the same request) share one module import per source.
  const sourcesByPath = new Map<string, Promise<CachedSource | null>>();

  const loadSource = (installedSource: EnabledExtensionSource["installedSource"]) => {
    const cached = sourcesByPath.get(installedSource.source_path);
    if (cached) return cached;

    const loading = loadExtensionSources({
      extensionPackages: [{ path: installedSource.source_path, sourceKind: installedSource.source_kind }],
    }).then((loaded) => {
      const source = loaded.sources[0];
      if (!source) return null;
      return { diagnostics: loaded.diagnostics, source };
    });
    sourcesByPath.set(installedSource.source_path, loading);
    return loading;
  };

  const getProjectRuntime = async (projectId: string) => {
    const enabledSources = await deps.extensionService.listEnabledSourcesForProject(projectId);
    const repos = await deps.repoService.listByProject(projectId);
    const cachedSources: CachedSource[] = [];

    for (const { installedSource } of enabledSources) {
      if (installedSource.status !== "loaded") continue;
      if (!existsSync(join(installedSource.source_path, "package.json"))) continue;

      const cached = await loadSource(installedSource);
      if (cached) cachedSources.push(cached);
    }

    return {
      enabledSources,
      runtime: normalizeExtensionSources(
        cachedSources.map((cached) => cached.source),
        cachedSources.flatMap((cached) => cached.diagnostics),
        { repoRoots: repos.map((repo) => repo.path).sort((left, right) => left.localeCompare(right)) },
      ),
    };
  };

  const refresh = () => {
    sourcesByPath.clear();
  };

  return { getProjectRuntime, refresh };
};
