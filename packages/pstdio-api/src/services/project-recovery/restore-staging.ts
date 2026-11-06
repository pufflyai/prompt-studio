import type { BigIntStats } from "node:fs";
import { chmod, lstat, mkdir, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { RecoveryRestoreError } from "./restore-error";
import type { RestoreExpected } from "./restore-plan";
import { openRecoverySource, type RecoverySourceHandle } from "./source-posix";

const entrySchema = z.strictObject({ path: z.string().min(1), dev: z.string(), ino: z.string(), pid: z.number() });

/** Restored directories can be read-only; staging removal makes them writable first. */
export const removeRecoveryStaging = async (path: string) => {
  try {
    await rm(path, { recursive: true, force: true });
    return;
  } catch {}
  const writable = async (directory: string) => {
    await chmod(directory, 0o700).catch(() => {});
    for (const name of await readdir(directory).catch(() => [])) {
      const child = join(directory, name);
      if ((await lstat(child).catch(() => null))?.isDirectory()) await writable(child);
    }
  };
  await writable(path);
  await rm(path, { recursive: true, force: true });
};

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

/**
 * Staging lives beside the destination, outside recovery storage, so a crash could leave it
 * behind. Each staging folder is journaled with its identity before anything is written in
 * it; a later start removes only folders that still have that identity and whose process ended.
 */
export const createRecoveryStagingJournal = (root: string) => {
  const directory = join(root, "restores");
  return {
    async record(path: string) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const { dev, ino } = await lstat(path, { bigint: true });
      const file = join(directory, `${crypto.randomUUID()}.json`);
      await writeFile(file, JSON.stringify({ path, dev: String(dev), ino: String(ino), pid: process.pid }), {
        mode: 0o600,
        flag: "wx",
      });
      return { done: () => unlink(file).catch(() => {}) };
    },
    async clean() {
      for (const name of await readdir(directory).catch(() => [])) {
        const file = join(directory, name);
        const entry = entrySchema.safeParse(
          await readFile(file, "utf8")
            .then(JSON.parse)
            .catch(() => null),
        ).data;
        if (entry && entry.pid !== process.pid && alive(entry.pid)) continue;
        if (entry && entry.pid === process.pid) continue;
        const stat = entry && (await lstat(entry.path, { bigint: true }).catch(() => null));
        if (stat?.isDirectory() && String(stat.dev) === entry?.dev && String(stat.ino) === entry.ino)
          await removeRecoveryStaging(entry.path);
        await unlink(file).catch(() => {});
      }
    },
  };
};

const keeps = (want: RestoreExpected, stat: BigIntStats, target: () => string) => {
  if (want.kind === "directory") return stat.isDirectory();
  if (want.kind === "symlink") return stat.isSymbolicLink() && target() === want.target;
  return stat.isFile() && stat.size === BigInt(want.size) && Number(stat.mode & 0o7777n) === want.mode;
};

/**
 * Re-reads the staged tree through held directory handles without following links and
 * compares every entry with the plan: nothing missing, extra, retyped or resized.
 */
export const verifyRecoveryStaging = async (
  staging: string,
  expected: Map<string, RestoreExpected>,
  signal?: AbortSignal,
) => {
  const source = await openRecoverySource(staging);
  let seen = 0;
  const mismatch = (path: string) =>
    new RecoveryRestoreError("unsupported", "This filesystem did not keep a restored entry as written", path);
  const visit = async (directory: RecoverySourceHandle, prefix: string) => {
    for (const name of directory.children()) {
      signal?.throwIfAborted();
      const path = prefix ? `${prefix}/${name}` : name;
      const want = expected.get(path);
      if (!want) throw mismatch(path);
      seen++;
      const entry = await directory.open(name);
      let recurse = false;
      try {
        const stat = await entry.stat();
        if (!keeps(want, stat, () => directory.readlink(name))) throw mismatch(path);
        recurse = want.kind === "directory";
      } finally {
        entry.close();
      }
      if (!recurse) continue;
      const opened = await directory.open(name, true);
      try {
        await visit(opened, path);
      } finally {
        opened.close();
      }
    }
  };
  try {
    await visit(source.root, "");
  } finally {
    source.close();
  }
  if (seen !== expected.size) throw mismatch("");
};
