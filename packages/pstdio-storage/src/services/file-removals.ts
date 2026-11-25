import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readdir, readFile, rm, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { readableFileDirectory } from "../storage/readable-file";

type File = { id: string; storage_path: string; project_id: string; owner: string | null };
type Receipt = {
  version: 1;
  operation: string;
  authority: string;
  file: File;
  source: string;
  staged: string;
  inode: { dev: string; ino: string } | null;
};
const flush = async (path: string) => {
  // Same platform limit as database publication (ADR 0104): Windows directory
  // fsync/power-loss recovery remains unqualified; process recovery still replays.
  if (process.platform === "win32") return;
  let directory: Awaited<ReturnType<typeof open>>;
  try {
    directory = await open(path, "r");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
};
const stat = async (path: string) => {
  try {
    return await lstat(path, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
const decode = (value: unknown, authority: string, filename: string) => {
  const row = value as Receipt;
  if (
    !row ||
    row.version !== 1 ||
    row.authority !== authority ||
    typeof row.operation !== "string" ||
    filename !== `${row.operation}.json` ||
    !/^[a-f0-9-]{36}$/.test(row.operation) ||
    !row.file ||
    typeof row.file.id !== "string" ||
    typeof row.file.project_id !== "string" ||
    typeof row.file.storage_path !== "string" ||
    (row.file.owner !== null && typeof row.file.owner !== "string") ||
    (row.inode !== null &&
      (!row.inode ||
        typeof row.inode.dev !== "string" ||
        typeof row.inode.ino !== "string" ||
        !/^\d+$/.test(row.inode.dev) ||
        !/^\d+$/.test(row.inode.ino))) ||
    row.source !== resolve(row.file.storage_path) ||
    row.staged !== `${row.source}.pstdio-remove-${row.operation}`
  )
    throw new Error("Invalid file removal receipt.");
  return row;
};
export const createFileRemovals = (storageRoot: string, authority: string) => {
  const root = resolve(storageRoot, "file-removals", createHash("sha256").update(authority).digest("hex"));
  const active = new Set<string>();
  const replays = new Map<string, Promise<void>>();
  const prepareRoot = async () => {
    await mkdir(root, { recursive: true, mode: 0o700 });
    // Setup or another database may just have created an ancestor. Persist the
    // entire hierarchy before this receipt can own removed bytes.
    for (let path = root; ; path = dirname(path)) {
      await flush(path);
      if (path === dirname(path)) break;
    }
  };
  const journal = (receipt: Receipt) => join(root, `${receipt.operation}.json`);
  const forget = async (receipt: Receipt) => {
    await rm(journal(receipt), { force: true });
    await flush(root);
  };
  const rollback = async (receipt: Receipt) => {
    const staged = await stat(receipt.staged);
    if (staged) {
      if (!receipt.inode || staged.dev.toString() !== receipt.inode.dev || staged.ino.toString() !== receipt.inode.ino)
        throw new Error(`File removal staging identity changed: ${receipt.file.id}`);
      const source = await stat(receipt.source);
      if (source && (source.ino !== staged.ino || source.dev !== staged.dev))
        throw new Error(`File removal recovery found conflicting bytes: ${receipt.file.id}`);
      if (!source) {
        await link(receipt.staged, receipt.source);
      }
      await flush(dirname(receipt.source));
      await rm(receipt.staged);
      await flush(dirname(receipt.source));
    }
    await forget(receipt);
  };
  const commit = async (receipt: Receipt) => {
    const staged = await stat(receipt.staged);
    if (
      staged &&
      (!receipt.inode || staged.dev.toString() !== receipt.inode.dev || staged.ino.toString() !== receipt.inode.ino)
    )
      throw new Error(`File removal staging identity changed: ${receipt.file.id}`);
    await rm(readableFileDirectory(receipt.source), { recursive: true, force: true });
    await rm(receipt.staged, { force: true });
    await flush(dirname(receipt.source));
    await forget(receipt);
  };
  const stage = async (file: File) => {
    const operation = randomUUID();
    const source = resolve(file.storage_path);
    const sourceStat = await stat(source);
    const receipt: Receipt = {
      version: 1,
      authority,
      operation,
      file: { id: file.id, project_id: file.project_id, owner: file.owner, storage_path: file.storage_path },
      source,
      staged: `${source}.pstdio-remove-${operation}`,
      inode: sourceStat ? { dev: sourceStat.dev.toString(), ino: sourceStat.ino.toString() } : null,
    };
    if (await stat(receipt.staged)) throw new Error("File removal staging path is occupied.");
    await prepareRoot();
    active.add(operation);
    const temporary = `${journal(receipt)}.tmp`;
    try {
      const marker = await open(temporary, "wx", 0o600);
      try {
        await marker.writeFile(JSON.stringify(receipt));
        await marker.sync();
      } finally {
        await marker.close();
      }
      await link(temporary, journal(receipt));
      await rm(temporary);
      await flush(root);
      let linked = false;
      try {
        await link(source, receipt.staged);
        linked = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          await forget(receipt);
          throw error;
        }
      }
      if (linked) {
        // Windows requires write access to flush an existing file handle.
        const bytes = await open(receipt.staged, process.platform === "win32" ? "r+" : "r");
        try {
          await bytes.sync();
        } finally {
          await bytes.close();
        }
        await flush(dirname(source));
        await unlink(source);
        await flush(dirname(source));
      }
    } catch (error) {
      try {
        await rollback(receipt);
      } finally {
        active.delete(operation);
        await rm(temporary, { force: true });
      }
      throw error;
    }
    return {
      commit: async () => {
        try {
          await commit(receipt);
        } finally {
          active.delete(operation);
        }
      },
      rollback: async () => {
        try {
          await rollback(receipt);
        } finally {
          active.delete(operation);
        }
      },
    };
  };
  const readReceipt = async (name: string) => {
    let contents: string;
    try {
      contents = await readFile(join(root, name), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    return decode(JSON.parse(contents), authority, name);
  };
  const settle = async (
    receipt: Receipt,
    get: (id: string) => Promise<{ storage_path: string; project_id: string } | null>,
  ) => {
    // A prior replay may have completed while the concurrent read was pending.
    if (!(await stat(journal(receipt)))) return;
    const file = await get(receipt.file.id);
    if (file && (resolve(file.storage_path) !== receipt.source || file.project_id !== receipt.file.project_id))
      throw new Error(`File removal receipt does not match its row: ${receipt.file.id}`);
    if (file) await rollback(receipt);
    else await commit(receipt);
  };
  const replay = async (
    name: string,
    get: (id: string) => Promise<{ storage_path: string; project_id: string } | null>,
    matches: (file: File) => boolean,
  ) => {
    const receipt = await readReceipt(name);
    if (!receipt || active.has(receipt.operation) || !matches(receipt.file)) return;
    const current = replays.get(receipt.operation);
    if (current) return current;
    const claimed = settle(receipt, get);
    replays.set(receipt.operation, claimed);
    try {
      await claimed;
    } finally {
      replays.delete(receipt.operation);
    }
  };
  const recover = async (
    get: (id: string) => Promise<{ storage_path: string; project_id: string } | null>,
    matches: (file: File) => boolean = () => true,
  ) => {
    const failures: Array<{ error: unknown; path: string }> = [];
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") failures.push({ error, path: root });
      return failures;
    }
    for (const name of entries) {
      try {
        const temporary = /^([a-f0-9-]{36})\.json\.tmp$/.exec(name);
        if (temporary && !active.has(temporary[1])) {
          await rm(join(root, name), { force: true });
          await flush(root);
        }
        if (!name.endsWith(".json")) continue;
        await replay(name, get, matches);
      } catch (error) {
        failures.push({ error, path: join(root, name) });
      }
    }
    return failures;
  };
  return { stage, recover };
};
