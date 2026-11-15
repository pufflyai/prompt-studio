import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join, parse, relative, resolve } from "node:path";

// Preserve relative compiler/source paths in a sparse filesystem mirror. Encode the
// volume separately so Windows drives/UNC roots cannot escape or collide in the cache.
export const revisionSnapshotPath = (generationRoot: string, source: string) => {
  let prefix = resolve(source);
  const suffix: string[] = [];
  while (!existsSync(prefix)) {
    suffix.unshift(basename(prefix));
    const parent = dirname(prefix);
    if (parent === prefix) break;
    prefix = parent;
  }
  const canonical = join(realpathSync(prefix), ...suffix);
  return revisionSnapshotLocation(generationRoot, canonical);
};
// Binding locations preserve the original symlink spelling; targets use canonical paths.
export const revisionSnapshotLocation = (generationRoot: string, source: string) => {
  const canonical = resolve(source);
  const root = parse(canonical).root;
  const volume = Buffer.from(process.platform === "win32" ? root.toLowerCase() : root).toString("hex");
  return join(generationRoot, "fs", volume, relative(root, canonical));
};
