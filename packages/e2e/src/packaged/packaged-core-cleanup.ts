import { lstat, readdir, rmdir, unlink } from "node:fs/promises";
import { join } from "node:path";

const removeEntries = async (paths: string[], remove: (path: string) => Promise<unknown>) => {
  let next = 0;
  const errors: unknown[] = [];
  await Promise.all(
    Array.from({ length: Math.min(64, paths.length) }, async () => {
      while (next < paths.length) {
        const path = paths[next++]!;
        try {
          await remove(path);
        } catch (error) {
          errors.push(error);
        }
      }
    }),
  );
  if (errors.length) throw new AggregateError(errors, "Could not remove owned fixture entries");
};

// Temporary fixture workaround: ADR 0110. Never follow links or outlive queued operations.
export const removeCoreFixture = async (root: string) => {
  const info = await lstat(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  if (!info) return;
  if (info.isSymbolicLink() || !info.isDirectory()) {
    await unlink(root);
    return;
  }

  const files: string[] = [];
  const directories: string[][] = [];
  const collect = async (directory: string, depth: number) => {
    const level = directories[depth] ?? [];
    directories[depth] = level;
    level.push(directory);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) await collect(path, depth + 1);
      else files.push(path);
    }
  };
  await collect(root, 0);
  await removeEntries(files, unlink);
  for (const level of directories.reverse()) await removeEntries(level, rmdir);
};
