import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import {
  extensionLoadKey,
  type LoadedExtensionSource,
  loadExtensionSourcesForHost as loadExtensionSources,
  normalizeExtensionSources,
} from "pstdio-extensions";
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
  const sourcesByPath = new Map<string, { loadKey: string; loading: Promise<CachedSource | null> }>();
  // Sources an invalidation reported as possibly changed. Their load key is compared
  // on the next read, so only a changed source is imported again.
  const uncheckedPaths = new Set<string>();
  // The last source that loaded cleanly, kept per source path. Replacing an install renames
  // the directory away for an instant, and publishing a snapshot without it would tell every
  // consumer the extension is gone — tearing down the views it owns instead of refreshing
  // them. An uninstalled source stops being enabled, so it is never retained.
  const lastHealthyByPath = new Map<string, CachedSource>();

  const load = (installedSource: LoadableExtensionSource) => {
    const key = canonicalSourcePath(installedSource.source_path);
    const cached = sourcesByPath.get(key);
    if (cached && !uncheckedPaths.has(key)) return cached.loading;
    uncheckedPaths.delete(key);
    // Read before the import, so an edit made during the import changes the key next time.
    const loadKey = extensionLoadKey(installedSource.source_path);
    if (cached?.loadKey === loadKey) return cached.loading;

    const loading: Promise<CachedSource | null> = (input.loadSources ?? loadExtensionSources)({
      extensionPackages: [{ path: installedSource.source_path, sourceKind: installedSource.source_kind }],
    }).then(
      (loaded) => {
        const source = loaded.sources[0];
        if (!source) return null;
        const value = { diagnostics: loaded.diagnostics, source };
        lastHealthyByPath.set(key, value);
        return value;
      },
      (error) => {
        // A rejected load must not poison the cache; the next read retries the import.
        if (sourcesByPath.get(key)?.loading === loading) sourcesByPath.delete(key);
        throw error;
      },
    );
    sourcesByPath.set(key, { loadKey, loading });
    return loading;
  };

  return {
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

      // What a source contributes is whatever it says on disk. A recorded error describes the
      // last refresh, not a second version of the source, so it must never decide the contents
      // of a snapshot: a source that no longer defines a command has to stop offering it, and a
      // source whose webview build failed still owns the commands its code declares.
      for (const { installedSource } of enabledSources) {
        if (!existsSync(join(installedSource.source_path, "package.json"))) {
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
