import { createHash, randomUUID } from "node:crypto";
import { existsSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

// Bundles depend on the Bun bundler and on the host's bundling plugins, which ship inside its
// executable. Another Bun or another executable build never reuses them.
export const runtimeHostKey = digest(
  [Bun.version, Bun.revision, process.execPath, statSync(process.execPath).mtimeMs].join("\0"),
);

// Cache cleanup never fails a load; a locked or vanished folder is left for a later pass.
const removeQuietly = (path: string) => {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch (error) {
    console.warn(`[pstdio-extensions] Could not remove runtime cache folder ${path}`, error);
  }
};

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
