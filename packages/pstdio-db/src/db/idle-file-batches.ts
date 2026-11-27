import { lstat, opendir, rmdir, unlink } from "node:fs/promises";
import { join } from "node:path";

type Entry = { path: string; directory: boolean };

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;

// Postorder leaves only empty directories eligible for removal. A writer can
// recreate a directory between batches, so never recursively remove a candidate.
async function* walk(path: string): AsyncGenerator<Entry> {
  const info = await lstat(path).catch((error) => {
    if (code(error) !== "ENOENT") throw error;
  });
  if (!info) return;
  if (info.isDirectory()) {
    const dir = await opendir(path).catch((error) => {
      if (code(error) !== "ENOENT") throw error;
    });
    if (dir) for await (const entry of dir) yield* walk(join(path, entry.name));
  }
  yield { path, directory: info.isDirectory() };
}

export async function* idleFileBatches(root: string) {
  let batch: Entry[] = [];
  for await (const entry of walk(root)) {
    batch.push(entry);
    if (batch.length === 16) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

export const removeIdleEntry = async (entry: Entry) => {
  try {
    if (entry.directory) await rmdir(entry.path);
    else await unlink(entry.path);
  } catch (error) {
    if (code(error) === "ENOENT") return;
    if (entry.directory && ["ENOTEMPTY", "EEXIST"].includes(code(error) ?? "")) return;
    throw error;
  }
};
