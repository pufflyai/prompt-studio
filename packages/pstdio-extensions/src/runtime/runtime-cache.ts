import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

// Bundles depend on the Bun bundler and on the host's bundling plugins, which ship inside its
// executable. Another Bun or another executable build never reuses them.
const hostKey = digest([Bun.version, Bun.revision, process.execPath, statSync(process.execPath).mtimeMs].join("\0"));
const preparedCacheRoots = new Set<string>();

/** The runtime cache of the running host. Caches of other hosts are removed once per process. */
export const runtimeCacheRoot = () => {
  const cacheRoot = join(resolvePstdioHome(), "cache", "extension-runtime");
  if (!preparedCacheRoots.has(cacheRoot)) {
    preparedCacheRoots.add(cacheRoot);
    if (existsSync(cacheRoot)) {
      for (const entry of readdirSync(cacheRoot)) {
        if (entry !== hostKey) rmSync(join(cacheRoot, entry), { recursive: true, force: true });
      }
    }
  }
  return join(cacheRoot, hostKey);
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
    rmSync(stagingPath, { recursive: true, force: true });
    if (!existsSync(runtimePackagePath)) throw error;
  }
};

/** Removes earlier copies of the same source folder once a newer copy has loaded. */
export const removeEarlierRuntimePackages = (runtimeRootPath: string) => {
  const current = basename(runtimeRootPath);
  const sourcePrefix = `${current.slice(0, current.indexOf("-"))}-`;
  const packageCacheDir = dirname(runtimeRootPath);
  for (const entry of readdirSync(packageCacheDir)) {
    if (entry !== current && entry.startsWith(sourcePrefix)) {
      rmSync(join(packageCacheDir, entry), { recursive: true, force: true });
    }
  }
};
