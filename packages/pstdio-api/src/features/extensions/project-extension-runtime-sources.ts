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
export type LoadableExtensionSource = Pick<EnabledExtensionSource["installedSource"], "source_kind" | "source_path"> &
  Partial<Pick<EnabledExtensionSource["installedSource"], "last_error_json">>;

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
  const candidates = new Map<string, Map<string, Promise<CachedSource | null>>>();
  const inspectCandidate = (source: LoadableExtensionSource, revision: PreparedExtensionRevision) => {
    const path = canonicalSourcePath(source.source_path);
    const byRevision = candidates.get(path) ?? new Map<string, Promise<CachedSource | null>>();
    candidates.set(path, byRevision);
    let work = byRevision.get(revision.id);
    if (!work) {
      work = (input.loadSources ?? loadExtensionSources)({
        extensionPackages: [{ path: source.source_path, sourceKind: source.source_kind }],
        preparedRevision: revision,
        immutableAssets: true,
      }).then((loaded) => (loaded.sources[0] ? { diagnostics: loaded.diagnostics, source: loaded.sources[0] } : null));
      byRevision.set(revision.id, work);
    }
    return work;
  };
  const sourcesByPath = new Map<string, { loadKey: string | null; loading: Promise<CachedSource | null> }>();
  // Sources an invalidation reported as possibly changed. Their load key is compared
  // on the next read, so only a changed source is imported again.
  const uncheckedPaths = new Set<string>();
  // The last source that loaded cleanly, kept per source path. Replacing an install renames
  // the directory away for an instant, and publishing a snapshot without it would tell every
  // consumer the extension is gone — tearing down the views it owns instead of refreshing
  // them. An uninstalled source stops being enabled, so it is never retained.
  const lastHealthyByPath = new Map<string, CachedSource>();

  const rememberLoaded = async (
    key: string,
    sourcePath: string,
    accepted: PreparedExtensionRevision | null,
    value: CachedSource,
  ) => {
    const current = sourcesByPath.get(key);
    const revision = value.source.preparedRevision;
    if (current && revision) current.loadKey = `${revision.loadKey}:${revision.id}`;
    if (!value.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      lastHealthyByPath.set(key, value);
      if (!accepted && revision) await acceptPreparedRevision(sourcePath, revision, { expectedId: null });
    }
    return value;
  };

  const readSources = (source: LoadableExtensionSource, accepted: PreparedExtensionRevision | null) => {
    if (accepted) {
      return inspectCandidate(source, accepted).then((cached) => ({
        sources: cached ? [cached.source] : [],
        diagnostics: cached?.diagnostics ?? [],
      }));
    }
    return (input.loadSources ?? loadExtensionSources)({
      extensionPackages: [{ path: source.source_path, sourceKind: source.source_kind }],
      immutableAssets: true,
    });
  };

  const inspections = new Map<string, Promise<CachedSource | null>>();
  const load = (installedSource: LoadableExtensionSource): Promise<CachedSource | null> => {
    // An ownership conflict is an activation gate, not a recoverable source-load failure.
    if (installedSource.last_error_json?.code === "extension_identity_conflict") return Promise.resolve(null);
    const key = canonicalSourcePath(installedSource.source_path);
    const pending = inspections.get(key);
    if (pending) {
      if (!uncheckedPaths.has(key)) return pending;
      // A source change must survive an inspection that captured the previous revision.
      const refresh = () => load(installedSource);
      return pending.then(refresh, refresh);
    }
    const cached = sourcesByPath.get(key);
    if (cached && !uncheckedPaths.has(key)) return cached.loading;
    uncheckedPaths.delete(key);
    const loading: Promise<CachedSource | null> = (async () => {
      const accepted = await readAcceptedRevision(installedSource.source_path);
      const inspect = input.loadSources ? hashExtensionSourceAsync : inspectExtensionLoadKey;
      // The default loader returns the input identity it computes during preparation.
      // Only rechecks and loaders without a prepared revision need a separate scan.
      let loadKey = accepted ? `${accepted.loadKey}:${accepted.id}` : null;
      if (!accepted && (cached || input.loadSources)) loadKey = await inspect(installedSource.source_path);
      if (cached?.loadKey === loadKey) return cached.loading;
      const currentLoad = () => inspections.get(key) === loading;
      if (!currentLoad()) return null;
      const imported = readSources(installedSource, accepted).then(async (loaded) => {
        const source = loaded.sources[0];
        if (!source || !currentLoad()) return null;
        return rememberLoaded(key, installedSource.source_path, accepted, { diagnostics: loaded.diagnostics, source });
      });
      sourcesByPath.set(key, { loadKey, loading: imported });
      return imported;
    })()
      .catch((error) => {
        if (inspections.get(key) === loading) sourcesByPath.delete(key);
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
    // A reload can recover a changed definition at the same prepared revision.
    reload: (sourcePath: string) => {
      const key = canonicalSourcePath(sourcePath);
      candidates.delete(key);
      sourcesByPath.delete(key);
      inspections.delete(key);
      uncheckedPaths.delete(key);
    },
    recheck: (sourcePath: string) => {
      const key = canonicalSourcePath(sourcePath);
      if (sourcesByPath.has(key) || inspections.has(key)) uncheckedPaths.add(key);
    },
    recheckAll: () => {
      for (const key of sourcesByPath.keys()) uncheckedPaths.add(key);
      for (const key of inspections.keys()) uncheckedPaths.add(key);
    },

    collect: async (enabledSources: readonly EnabledExtensionSource[]) => {
      // The preparation pool owns admission. Queue independent source reads together
      // and preserve the declaration order when assembling the project snapshot.
      const records = await Promise.all(
        enabledSources.map(async ({ installedSource }) => {
          if (installedSource.last_error_json?.code === "extension_identity_conflict") return null;
          if (
            !existsSync(join(installedSource.source_path, "package.json")) &&
            !(await readAcceptedRevision(installedSource.source_path))
          ) {
            // A transient rename can hide the source while an upgrade is being promoted.
            return lastHealthyByPath.get(canonicalSourcePath(installedSource.source_path)) ?? null;
          }
          return load(installedSource);
        }),
      );
      return records.filter((record) => record !== null);
    },
  };
};
