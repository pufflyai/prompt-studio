import fs from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { expandHomePath, resolvePstdioDbPath } from "pstdio-paths";

export const resolveDbPath = (dbPath?: string) => {
  return expandHomePath(dbPath ?? process.env.PSTDIO_DB_PATH ?? resolvePstdioDbPath());
};

export const canonicalDbPath = (dbPath: string) => {
  if (dbPath === ":memory:") return dbPath;
  const requested = resolve(dbPath);
  // Preserve existing symlink targets. A dangling symlink must not become a new home.
  if (fs.lstatSync(requested, { throwIfNoEntry: false })) return fs.realpathSync(requested);
  fs.mkdirSync(dirname(requested), { recursive: true });
  return join(fs.realpathSync(dirname(requested)), basename(requested));
};
