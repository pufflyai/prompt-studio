import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { type LoadedExtensionSource, loadExtensionSources } from "pstdio-extensions";
import type { EnabledExtensionSource } from "./project-extension-runtime-snapshot";

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
// cache is the runtime's memory invariant.
export const createExtensionSourceCache = (input: { loadSources?: typeof loadExtensionSources }) => {
  const sourcesByPath = new Map<string, Promise<CachedSource | null>>();
  // The last source that loaded cleanly, kept per source path. A source being rewritten
  // is briefly not `loaded`, and publishing a snapshot without it would tell every
  // consumer the extension is gone — tearing down the views it owns instead of
  // refreshing them. An uninstalled source stops being enabled, so it is never retained.
  const lastHealthyByPath = new Map<string, CachedSource>();

  const load = (installedSource: EnabledExtensionSource["installedSource"]) => {
    const key = canonicalSourcePath(installedSource.source_path);
    const cached = sourcesByPath.get(key);
    if (cached) return cached;

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
        if (sourcesByPath.get(key) === loading) sourcesByPath.delete(key);
        throw error;
      },
    );
    sourcesByPath.set(key, loading);
    return loading;
  };

  return {
    load,
    forget: (sourcePath: string) => sourcesByPath.delete(canonicalSourcePath(sourcePath)),
    forgetAll: () => sourcesByPath.clear(),

    collect: async (enabledSources: readonly EnabledExtensionSource[]) => {
      const cachedSources: CachedSource[] = [];

      for (const { installedSource } of enabledSources) {
        const retained = lastHealthyByPath.get(canonicalSourcePath(installedSource.source_path));
        if (installedSource.status !== "loaded" || !existsSync(join(installedSource.source_path, "package.json"))) {
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
