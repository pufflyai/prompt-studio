import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import {
  acceptPreparedRevision,
  inspectExtensionLoadKey,
  type LoadedExtensionSource,
  loadExtensionSources,
  normalizeExtensionSources,
  type PreparedExtensionRevision,
  readAcceptedRevision,
} from "pstdio-extensions";
import { hashExtensionSourceAsync } from "./extension-preparation";
import type { EnabledExtensionSource } from "./project-extension-runtime-snapshot";

/** The fields a source needs to be imported, so an unpersisted candidate can be loaded too. */
export type LoadableExtensionSource = Pick<EnabledExtensionSource["installedSource"], "source_kind" | "source_path">;

export type CachedSource = {
  diagnostics: Awaited<ReturnType<typeof loadExtensionSources>>["diagnostics"];
  source: LoadedExtensionSource;
};

// A source is one thing on disk, but the path that reaches us depends on the caller: an
// install records the path the user gave, while a filesystem watcher reports the resolved
// path. Comparing them as written makes a change to a source behind a symlink invalidate
// nothing, so every source path is keyed by its resolved form.
export const canonicalSourcePath = (sourcePath: string) => {
  try {
    return realpathSync(sourcePath);
  } catch {
    return sourcePath;
  }
};

// Owns one module import per source version, shared by every project and every
// concurrent read. Bun retains each import identity for the process lifetime, so this
// cache is the runtime's memory invariant. Harness workers also live as long as their
// provider's import, so importing an unchanged source again would stop running agents.
export const createExtensionSourceCache = (input: { loadSources?: typeof loadExtensionSources }) => {
  const candidates = new Map<string, Promise<CachedSource | null>>();
  const inspectCandidate = (source: LoadableExtensionSource, revision: PreparedExtensionRevision) => {
    const key = `${canonicalSourcePath(source.source_path)}:${revision.id}`;
    let work = candidates.get(key);
    if (!work) {
      work = (input.loadSources ?? loadExtensionSources)({
        extensionPackages: [{ path: source.source_path, sourceKind: source.source_kind }],
        preparedRevision: revision,
        immutableAssets: true,
      }).then((loaded) => (loaded.sources[0] ? { diagnostics: loaded.diagnostics, source: loaded.sources[0] } : null));
      candidates.set(key, work);
    }
    return work;
  };
  const sourcesByPath = new Map<string, { loadKey: string; loading: Promise<CachedSource | null> }>();
  // Sources an invalidation reported as possibly changed. Their load key is compared
  // on the next read, so only a changed source is imported again.
  const uncheckedPaths = new Set<string>();
  // The last source that loaded cleanly, kept per source path. Replacing an install renames
  // the directory away for an instant, and publishing a snapshot without it would tell every
  // consumer the extension is gone — tearing down the views it owns instead of refreshing
  // them. An uninstalled source stops being enabled, so it is never retained.
  const lastHealthyByPath = new Map<string, CachedSource>();

  const inspections = new Map<string, Promise<CachedSource | null>>();
  const load = (installedSource: LoadableExtensionSource): Promise<CachedSource | null> => {
    const key = canonicalSourcePath(installedSource.source_path);
    const cached = sourcesByPath.get(key);
    if (cached && !uncheckedPaths.has(key)) return cached.loading;
    uncheckedPaths.delete(key);
    const pending = inspections.get(key);
    if (pending) return pending;
    const loading = (async () => {
      const accepted = await readAcceptedRevision(installedSource.source_path);
      const inspect = input.loadSources ? hashExtensionSourceAsync : inspectExtensionLoadKey;
      const loadKey = accepted ? `${accepted.loadKey}:${accepted.id}` : await inspect(installedSource.source_path);
      if (cached?.loadKey === loadKey) return cached.loading;
      const prepared = accepted
        ? inspectCandidate(installedSource, accepted).then((cached) => ({
            sources: cached ? [cached.source] : [],
            diagnostics: cached?.diagnostics ?? [],
          }))
        : (input.loadSources ?? loadExtensionSources)({
            extensionPackages: [{ path: installedSource.source_path, sourceKind: installedSource.source_kind }],
            preparedRevision: accepted ?? undefined,
            immutableAssets: true,
          });
      const imported = prepared.then(async (loaded) => {
        const source = loaded.sources[0];
        if (!source) return null;
        const current = sourcesByPath.get(key);
        if (current && source.preparedRevision)
          current.loadKey = `${source.preparedRevision.loadKey}:${source.preparedRevision.id}`;
        const value = { diagnostics: loaded.diagnostics, source };
        if (!loaded.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
          lastHealthyByPath.set(key, value);
          if (!accepted && source.preparedRevision)
            await acceptPreparedRevision(installedSource.source_path, source.preparedRevision, { expectedId: null });
        }
        return value;
      });
      sourcesByPath.set(key, { loadKey, loading: imported });
      return imported;
    })()
      .catch((error) => {
        sourcesByPath.delete(key);
        throw error;
      })
      .finally(() => {
        if (inspections.get(key) === loading) inspections.delete(key);
      });
    inspections.set(key, loading);
    return loading;
  };

  return {
    inspectCandidate,
    load,
    // Reads installed sources whatever their enabled state. The host-wide harness registry reads
    // every source this way, so a source that did not change keeps its harnesses and their workers.
    loadRuntime: async (installedSources: readonly LoadableExtensionSource[]) => {
      const loaded: CachedSource[] = [];
      for (const installedSource of installedSources) {
        const cached = await load(installedSource);
        if (cached) loaded.push(cached);
      }
      return normalizeExtensionSources(
        loaded.map(({ source }) => source),
        loaded.flatMap(({ diagnostics }) => diagnostics),
      );
    },
    recheck: (sourcePath: string) => {
      const key = canonicalSourcePath(sourcePath);
      if (sourcesByPath.has(key)) uncheckedPaths.add(key);
    },
    recheckAll: () => {
      for (const key of sourcesByPath.keys()) uncheckedPaths.add(key);
    },

    collect: async (enabledSources: readonly EnabledExtensionSource[]) => {
      const cachedSources: CachedSource[] = [];

      // Accepted artifacts remain usable if an offline edit removes the manifest. A source
      // disappears from this catalog when its installed instance is disabled or uninstalled.
      for (const { installedSource } of enabledSources) {
        if (
          !existsSync(join(installedSource.source_path, "package.json")) &&
          !(await readAcceptedRevision(installedSource.source_path))
        ) {
          const retained = lastHealthyByPath.get(canonicalSourcePath(installedSource.source_path));
          if (retained) cachedSources.push(retained);
          continue;
        }

        const cached = await load(installedSource);
        if (cached) cachedSources.push(cached);
      }

      return cachedSources;
    },
  };
};
