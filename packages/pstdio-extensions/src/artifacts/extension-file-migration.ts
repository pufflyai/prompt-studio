import { constants } from "node:fs";
import { copyFile, link, lstat, mkdir, open, readdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalExtensionId, extensionIdentityRenames } from "pstdio-api-contracts/extension-identity";
import { extensionIdentityBackupName } from "./extension-identity-backup";

const pending = new Map<string, Promise<void>>();
const stat = async (path: string) => {
  try {
    const entry = await lstat(path);
    if (entry.isSymbolicLink()) throw new Error(`Extension storage migration refuses symbolic link: ${path}`);
    return entry;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};
const equal = async (left: string, right: string) => {
  const a = await open(left, "r");
  try {
    const b = await open(right, "r");
    try {
      if ((await a.stat()).size !== (await b.stat()).size) return false;
      const first = Buffer.alloc(64 * 1024);
      const second = Buffer.alloc(first.length);
      let position = 0;
      while (true) {
        const { bytesRead } = await a.read(first, 0, first.length, position);
        if (!bytesRead) return true;
        const read = await b.read(second, 0, bytesRead, position);
        if (read.bytesRead !== bytesRead || !first.subarray(0, bytesRead).equals(second.subarray(0, bytesRead)))
          return false;
        position += bytesRead;
      }
    } finally {
      await b.close();
    }
  } finally {
    await a.close();
  }
};
const conflict = (path: string) => new Error(`Extension storage file conflict: ${path}. Both versions were retained.`);

const preflight = async (source: string, target: string) => {
  const from = await stat(source);
  const to = await stat(target);
  if (!from) return;
  if (from.isDirectory()) {
    if (to && !to.isDirectory()) throw conflict(target);
    for (const name of await readdir(source)) await preflight(join(source, name), join(target, name));
  } else if (!from.isFile() || (to && (!to.isFile() || !(await equal(source, target))))) throw conflict(target);
};

const copy = async (source: string, target: string) => {
  const from = await stat(source);
  if (!from) return;
  if (from.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const name of await readdir(source)) await copy(join(source, name), join(target, name));
  } else {
    await mkdir(dirname(target), { recursive: true });
    const temporary = join(dirname(target), `.extension-migration-${crypto.randomUUID()}.tmp`);
    try {
      await copyFile(source, temporary, constants.COPYFILE_EXCL);
      const file = await open(temporary, "r+");
      try {
        await file.sync();
      } finally {
        await file.close();
      }
      if (!(await equal(source, temporary))) throw conflict(target);
      // A hard-link publication is atomic and cannot replace a file created by another writer.
      try {
        await link(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        await stat(target);
        if (!(await equal(source, target))) throw conflict(target);
      }
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
};

const syncDirectory = async (path: string) => {
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
};
const syncTree = async (path: string) => {
  for (const name of await readdir(path)) {
    const child = join(path, name);
    if ((await stat(child))?.isDirectory()) await syncTree(child);
    else {
      const file = await open(child, "r");
      try {
        await file.sync();
      } finally {
        await file.close();
      }
    }
  }
  await syncDirectory(path);
};

/** Windows has no portable directory fsync. Keep the original tree as allocated, hidden evidence. */
export const retainExtensionMigrationSource = async (source: string, target: string) => {
  if (!(await stat(source))) return;
  const backup = join(target, extensionIdentityBackupName);
  if (await stat(backup)) throw conflict(backup);
  await rename(source, backup);
};

/** Called before workspace access, including a previously unavailable workspace's first write. */
export const migrateExtensionFiles = (workspace: string, extensionId?: string) => {
  const root = resolve(workspace);
  const previous = pending.get(root);
  const run = (previous ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const pstdio = join(root, ".pstdio");
      if (!(await stat(pstdio))) return;
      const storage = join(pstdio, "extension-storage");
      if (!(await stat(storage))) return;
      const renames = extensionIdentityRenames.filter(
        ({ to }) => !extensionId || `${to.publisher}.${to.name}` === canonicalExtensionId(extensionId),
      );
      const moves = renames.map(({ from, to }) => ({
        source: join(storage, `${from.publisher}.${from.name}`),
        target: join(storage, `${to.publisher}.${to.name}`),
      }));
      // Detect every known conflict before modifying any tree. A failed copy retains its entire source.
      for (const move of moves) await preflight(move.source, move.target);
      for (const { source, target } of moves) {
        if (!(await stat(source))) continue;
        await copy(source, target);
        await preflight(source, target);
        if (process.platform === "win32") await retainExtensionMigrationSource(source, target);
        else {
          await syncTree(target);
          await syncDirectory(storage);
          await syncDirectory(pstdio);
          await rm(source, { recursive: true });
          await syncDirectory(storage);
        }
      }
      const ignore = join(pstdio, ".gitignore");
      if (!(await stat(ignore))) return;
      const text = await readFile(ignore, "utf8");
      const next = text
        .split("\n")
        .map((line) => {
          for (const { from, to } of renames) {
            const old = `/extension-storage/${from.publisher}.${from.name}/`;
            if (line === old) return `/extension-storage/${to.publisher}.${to.name}/`;
            if (line === `# pstdio:ignore-owned ${old}`)
              return `# pstdio:ignore-owned /extension-storage/${to.publisher}.${to.name}/`;
          }
          return line;
        })
        .join("\n");
      if (next !== text) await writeFile(ignore, next);
    });
  pending.set(root, run);
  return run.finally(() => {
    if (pending.get(root) === run) pending.delete(root);
  });
};
