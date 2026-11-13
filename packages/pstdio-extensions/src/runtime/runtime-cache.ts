import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, utimesSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

// Bundles depend on the Bun bundler and on the host's bundling plugins, which ship inside its
// executable. Another Bun or another executable build never reuses them.
export const runtimeHostKey = digest(
  [Bun.version, Bun.revision, process.execPath, statSync(process.execPath).mtimeMs].join("\0"),
);
// Another host, such as the CLI next to the desktop app, may still use its cache; only a cache
// left unused this long belongs to a replaced host.
const UNUSED_HOST_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const preparedCacheRoots = new Set<string>();

// Cache cleanup never fails a load; a locked or vanished folder is left for a later pass.
const removeQuietly = (path: string) => {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch (error) {
    console.warn(`[pstdio-extensions] Could not remove runtime cache folder ${path}`, error);
  }
};

const prepareCacheRoot = (cacheRoot: string, hostRoot: string) => {
  try {
    mkdirSync(hostRoot, { recursive: true });
    const now = new Date();
    utimesSync(hostRoot, now, now);
    for (const entry of readdirSync(cacheRoot)) {
      const path = join(cacheRoot, entry);
      if (entry !== runtimeHostKey && now.getTime() - statSync(path).mtimeMs > UNUSED_HOST_CACHE_MS)
        removeQuietly(path);
    }
  } catch (error) {
    console.warn(`[pstdio-extensions] Could not prepare runtime cache ${cacheRoot}`, error);
  }
};

/** The runtime cache of the running host. Caches of hosts unused for a week are removed. */
export const runtimeCacheRoot = () => {
  const cacheRoot = join(resolvePstdioHome(), "cache", "extension-runtime");
  const hostRoot = join(cacheRoot, runtimeHostKey);
  if (!preparedCacheRoots.has(cacheRoot)) {
    preparedCacheRoots.add(cacheRoot);
    prepareCacheRoot(cacheRoot, hostRoot);
  }
  return hostRoot;
};

/** Names one copy of an extension package; copies of the same source folder share the prefix. */
export const runtimePackageKey = (packagePath: string, sourceKey: string) => `${digest(packagePath)}-${sourceKey}`;

/**
 * Creates `runtimePackagePath` from a staging folder, so an interrupted or failed copy is never
 * reused after a restart. When another loader publishes first, its copy is used.
 */
export const publishRuntimePackage = (runtimePackagePath: string, write: (stagingPath: string) => void) => {
  if (existsSync(runtimePackagePath)) return;
  const stagingPath = join(dirname(runtimePackagePath), `staging-${process.pid}-${randomUUID()}`);
  try {
    write(stagingPath);
    renameSync(stagingPath, runtimePackagePath);
  } catch (error) {
    removeQuietly(stagingPath);
    if (!existsSync(runtimePackagePath)) throw error;
  }
};

const sourceOf = (runtimeRootPath: string) => {
  const key = basename(runtimeRootPath);
  return { dir: dirname(runtimeRootPath), key, prefix: `${key.slice(0, key.indexOf("-"))}-` };
};

const newestKeyBySource = new Map<string, string>();
const loadingRoots = new Map<string, number>();

/**
 * Records a load of one runtime copy. When it succeeds and is still the newest requested copy of
 * its source folder, earlier copies that no load in this process still uses are removed.
 */
export const beginRuntimeLoad = (runtimeRootPath: string) => {
  const { dir, key, prefix } = sourceOf(runtimeRootPath);
  newestKeyBySource.set(join(dir, prefix), key);
  loadingRoots.set(runtimeRootPath, (loadingRoots.get(runtimeRootPath) ?? 0) + 1);
  return {
    finish(loaded: boolean) {
      const remaining = (loadingRoots.get(runtimeRootPath) ?? 1) - 1;
      if (remaining > 0) loadingRoots.set(runtimeRootPath, remaining);
      else loadingRoots.delete(runtimeRootPath);
      if (!loaded || newestKeyBySource.get(join(dir, prefix)) !== key) return;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const path = join(dir, entry);
        if (entry !== key && entry.startsWith(prefix) && !loadingRoots.has(path)) removeQuietly(path);
      }
    },
  };
};
