import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// All entries have already passed the archive's path and identity checks. Complete
// every admitted write before returning an error so staging cleanup cannot race it.
export const extractEntries = async <T>(
  root: string,
  entries: Iterable<readonly [string, T]>,
  write: (target: string, value: T) => Promise<void>,
) => {
  const pending = entries[Symbol.iterator]();
  const directories = new Map<string, Promise<unknown>>();
  const worker = async () => {
    for (let entry = pending.next(); !entry.done; entry = pending.next()) {
      const [name, value] = entry.value;
      const target = join(root, name);
      const dir = dirname(target);
      let ready = directories.get(dir);
      if (!ready) {
        ready = mkdir(dir, { recursive: true });
        directories.set(dir, ready);
      }
      await ready;
      await write(target, value);
    }
  };
  const results = await Promise.allSettled(Array.from({ length: 8 }, worker));
  for (const result of results) if (result.status === "rejected") throw result.reason;
};

export const extractFiles = (root: string, files: ReadonlyMap<string, File>) =>
  extractEntries(root, files, async (target, file) => writeFile(target, new Uint8Array(await file.arrayBuffer())));
