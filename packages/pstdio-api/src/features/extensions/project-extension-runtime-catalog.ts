import { existsSync } from "node:fs";
import { join } from "node:path";
import { type LoadedExtensionSource, loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import type { createExtensionService } from "../../services/extension-service";
import type { createProjectService } from "../../services/project-service";
import type { createRepoService } from "../../services/repo-service";
import {
  type EnabledExtensionSource,
  ExtensionRuntimeGenerationStaleError,
  ExtensionRuntimeLoadFailedError,
  ExtensionRuntimeProjectMissingError,
  freezeSnapshot,
  type ProjectExtensionRuntimeSnapshot,
  type RuntimeInvalidationReason,
} from "./project-extension-runtime-snapshot";

type CachedSource = {
  diagnostics: Awaited<ReturnType<typeof loadExtensionSources>>["diagnostics"];
  source: LoadedExtensionSource;
};

type ProjectState = {
  /** Bumped on every invalidation; a load may publish only if it still matches. */
  revision: number;
  /** Revision the current snapshot was built from; differing from revision means dirty. */
  loadedRevision: number;
  dirtyReason: RuntimeInvalidationReason | null;
  current: ProjectExtensionRuntimeSnapshot | null;
  /** Last healthy snapshot re-published with a stale marker after a whole-load failure. */
  staleView: ProjectExtensionRuntimeSnapshot | null;
  loading: Promise<ProjectExtensionRuntimeSnapshot> | null;
  /** Source paths from the last read of enabled sources; drives reverse lookup. */
  knownSourcePaths: Set<string>;
  loadCount: number;
};

// Test seam: reports catalog activity without exposing handlers or settings.
export type ProjectExtensionRuntimeCatalogObserver = {
  onLoadStart?: (event: { projectId: string; reason: string; revision: number }) => void;
  onPublish?: (event: { projectId: string; generation: number; loadCount: number }) => void;
  onDiscard?: (event: { projectId: string; code: "extension_runtime_generation_stale" }) => void;
};

export type ProjectExtensionRuntimeCatalog = ReturnType<typeof createProjectExtensionRuntimeCatalog>;

export const createProjectExtensionRuntimeCatalog = (deps: {
  extensionService: ReturnType<typeof createExtensionService>;
  projectService: ReturnType<typeof createProjectService>;
  repoService: ReturnType<typeof createRepoService>;
  loadSources?: typeof loadExtensionSources;
  observer?: ProjectExtensionRuntimeCatalogObserver;
}) => {
  // Caches the in-flight load promise per source path so every project and every
  // concurrent read shares one module import per source version. Bun retains each
  // import identity for the process lifetime, so this map is the memory invariant.
  const sourcesByPath = new Map<string, Promise<CachedSource | null>>();
  const states = new Map<string, ProjectState>();
  let generation = 0;

  const stateFor = (projectId: string) => {
    const existing = states.get(projectId);
    if (existing) return existing;
    const created: ProjectState = {
      revision: 0,
      loadedRevision: -1,
      dirtyReason: null,
      current: null,
      staleView: null,
      loading: null,
      knownSourcePaths: new Set(),
      loadCount: 0,
    };
    states.set(projectId, created);
    return created;
  };

  const loadSource = (installedSource: EnabledExtensionSource["installedSource"]) => {
    const cached = sourcesByPath.get(installedSource.source_path);
    if (cached) return cached;

    const loading: Promise<CachedSource | null> = (deps.loadSources ?? loadExtensionSources)({
      extensionPackages: [{ path: installedSource.source_path, sourceKind: installedSource.source_kind }],
    }).then(
      (loaded) => {
        const source = loaded.sources[0];
        if (!source) return null;
        return { diagnostics: loaded.diagnostics, source };
      },
      (error) => {
        // A rejected load must not poison the cache; the next read retries the import.
        if (sourcesByPath.get(installedSource.source_path) === loading) {
          sourcesByPath.delete(installedSource.source_path);
        }
        throw error;
      },
    );
    sourcesByPath.set(installedSource.source_path, loading);
    return loading;
  };

  const runLoad = async (projectId: string, state: ProjectState) => {
    const startedAt = performance.now();
    const startRevision = state.revision;
    const reason: string = state.current ? (state.dirtyReason ?? "runtime_refresh") : "cold_read";
    state.loadCount += 1;
    deps.observer?.onLoadStart?.({ projectId, reason, revision: startRevision });
    apiLogger.info(
      { event: "extensions.runtime_catalog.load_start", project_id: projectId, reason, revision: startRevision },
      "Loading project extension runtime snapshot",
    );

    try {
      const project = await deps.projectService.get(projectId);
      if (!project) throw new ExtensionRuntimeProjectMissingError(projectId);

      const enabledSources = await deps.extensionService.listEnabledSourcesForProject(projectId);
      state.knownSourcePaths = new Set(enabledSources.map((source) => source.installedSource.source_path));
      const repos = await deps.repoService.listByProject(projectId);
      const cachedSources: CachedSource[] = [];

      for (const { installedSource } of enabledSources) {
        if (installedSource.status !== "loaded") continue;
        if (!existsSync(join(installedSource.source_path, "package.json"))) continue;

        const cached = await loadSource(installedSource);
        if (cached) cachedSources.push(cached);
      }

      const runtime = normalizeExtensionSources(
        cachedSources.map((cached) => cached.source),
        cachedSources.flatMap((cached) => cached.diagnostics),
        { repoRoots: repos.map((repo) => repo.path).sort((left, right) => left.localeCompare(right)) },
      );

      if (state.revision !== startRevision) {
        deps.observer?.onDiscard?.({ projectId, code: "extension_runtime_generation_stale" });
        apiLogger.info(
          {
            code: "extension_runtime_generation_stale",
            duration_ms: Math.round(performance.now() - startedAt),
            event: "extensions.runtime_catalog.discarded",
            project_id: projectId,
            reason,
            revision: startRevision,
          },
          "Discarded a project extension runtime load that was invalidated while in flight",
        );
        throw new ExtensionRuntimeGenerationStaleError(projectId);
      }

      generation += 1;
      const snapshot = freezeSnapshot({
        generation,
        project: { id: project.id, name: project.name, shorthand: project.shorthand },
        enabledSources,
        runtime,
        stale: null,
      });
      state.current = snapshot;
      state.staleView = null;
      state.loadedRevision = startRevision;
      state.dirtyReason = null;
      deps.observer?.onPublish?.({ projectId, generation, loadCount: state.loadCount });
      apiLogger.info(
        {
          duration_ms: Math.round(performance.now() - startedAt),
          event: "extensions.runtime_catalog.published",
          generation,
          project_id: projectId,
          reason,
          source_count: enabledSources.length,
        },
        "Published project extension runtime snapshot",
      );
      return snapshot;
    } catch (error) {
      if (!(error instanceof ExtensionRuntimeGenerationStaleError)) {
        apiLogger.error(
          {
            duration_ms: Math.round(performance.now() - startedAt),
            err: error,
            event: "extensions.runtime_catalog.load_failed",
            project_id: projectId,
            reason,
          },
          "Project extension runtime load failed",
        );
      }
      throw error;
    }
  };

  const staleViewFor = (state: ProjectState, error: unknown) => {
    state.staleView ??= freezeSnapshot({
      ...(state.current as ProjectExtensionRuntimeSnapshot),
      stale: {
        code: "extension_runtime_load_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return state.staleView;
  };

  const get = async (projectId: string): Promise<ProjectExtensionRuntimeSnapshot> => {
    const state = stateFor(projectId);

    for (;;) {
      if (state.current && state.loadedRevision === state.revision) return state.current;

      const loading = (state.loading ??= runLoad(projectId, state).finally(() => {
        if (state.loading === loading) state.loading = null;
      }));

      try {
        return await loading;
      } catch (error) {
        // A load invalidated in flight never becomes current; read the latest revision.
        if (error instanceof ExtensionRuntimeGenerationStaleError) continue;
        if (error instanceof ExtensionRuntimeProjectMissingError) throw error;
        // Whole-load infrastructure failure: nothing about the sources changed, so
        // the last healthy snapshot stays valid. It is served marked stale and the
        // project stays dirty, which retries the load on the next read.
        if (state.current) return staleViewFor(state, error);
        throw new ExtensionRuntimeLoadFailedError(projectId, error);
      }
    }
  };

  // Loads one installed source's runtime regardless of its enabled state, so the
  // dashboard can document what a disabled extension would contribute.
  const getInstalledSourceRuntime = async (installedSource: EnabledExtensionSource["installedSource"]) => {
    const cached = await loadSource(installedSource);
    if (!cached) return normalizeExtensionSources([], [], { repoRoots: [] });
    return normalizeExtensionSources([cached.source], cached.diagnostics, { repoRoots: [] });
  };

  const markDirty = (state: ProjectState, reason: RuntimeInvalidationReason) => {
    state.revision += 1;
    state.dirtyReason = reason;
  };

  // Marks affected projects dirty; the replacement snapshot builds lazily on the
  // next read, so several invalidations coalesce into one load.
  const invalidate = (input: { projectId?: string; sourcePath?: string; reason: RuntimeInvalidationReason }) => {
    let affected = 0;

    if (input.sourcePath) {
      sourcesByPath.delete(input.sourcePath);
      for (const [projectId, state] of states) {
        if (projectId !== input.projectId && !state.knownSourcePaths.has(input.sourcePath)) continue;
        markDirty(state, input.reason);
        affected += 1;
      }
    } else if (input.projectId) {
      const state = states.get(input.projectId);
      if (state) {
        markDirty(state, input.reason);
        affected = 1;
      }
    } else {
      sourcesByPath.clear();
      for (const state of states.values()) {
        markDirty(state, input.reason);
        affected += 1;
      }
    }

    apiLogger.info(
      {
        affected_projects: affected,
        event: "extensions.runtime_catalog.invalidated",
        project_id: input.projectId,
        reason: input.reason,
        source_path: input.sourcePath,
      },
      "Invalidated project extension runtime snapshots",
    );
  };

  return { get, getInstalledSourceRuntime, invalidate };
};
