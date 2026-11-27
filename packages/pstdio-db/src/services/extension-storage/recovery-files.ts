import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, opendir, readFile, rename, rm, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import type { DbClient } from "../../db/connection.pglite";
import { flushDirectory } from "../../db/pglite-home-recovery";

export interface RecoveryReference {
  sha256: string;
  bytes: number;
}
export interface RecoveryBytes {
  records: Uint8Array;
  metadata: Uint8Array;
}
const compress = promisify(gzip);
const decompress = promisify(gunzip);
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const prepareRecoveryBytes = async (content: RecoveryBytes) => {
  const data = new Uint8Array(
    await compress(
      JSON.stringify({
        records: Buffer.from(content.records).toString("base64"),
        metadata: Buffer.from(content.metadata).toString("base64"),
      }),
    ),
  );
  return { sha256: hash(data), bytes: data.length, data };
};
export type PreparedRecoveryBytes = Awaited<ReturnType<typeof prepareRecoveryBytes>>;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const projectSegment = (projectId: string) => `p-${Buffer.from(projectId).toString("hex")}`;
const address = (projectId: string, hours: number, sha256: string) => JSON.stringify([projectId, hours, sha256]);
const verify = (bytes: Uint8Array, reference: RecoveryReference) => {
  if (bytes.length !== reference.bytes || hash(bytes) !== reference.sha256)
    throw new Error("The saved recovery file is damaged");
};
async function* entries(path: string) {
  const directory = await opendir(path).catch((error) => {
    if (!missing(error)) throw error;
  });
  if (directory) for await (const entry of directory) yield entry;
}
const ensureDirectory = async (directory: string) => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Existing entries may be left by an interrupted mkdir or rename. Flush all
  // parents, including custom ancestors created before this store was opened.
  const levels = [];
  for (let level = resolve(directory); ; level = dirname(level)) {
    levels.push(level);
    if (dirname(level) === level) break;
  }
  for (const level of levels.reverse()) await flushDirectory(level);
};

const retainMemory = (memory: Map<string, Uint8Array>, projectId: string, references: Map<number, Set<string>>) => {
  for (const key of memory.keys()) {
    const [project, hours, sha256] = JSON.parse(key) as [string, number, string];
    if (project === projectId && !references.get(hours)?.has(sha256)) memory.delete(key);
  }
};
const retainSlot = async (directory: string, retained: Set<string>) => {
  let nonempty = false;
  for await (const file of entries(directory)) {
    if (file.name.endsWith(".json.gz") && retained.has(file.name.slice(0, -8)) && file.isFile()) nonempty = true;
    else await rm(join(directory, file.name), { recursive: true, force: true });
  }
  if (!nonempty) await rmdir(directory);
  return nonempty;
};

/** Immutable files precede their SQL references. Base64 inside the gzipped JSON keeps
 * released compressed payloads byte-exact, including opaque input not opened by a restore. */
export const createRecoveryFiles = (root?: string) => {
  const memory = new Map<string, Uint8Array>();
  const projectPath = (projectId: string) => join(root!, projectSegment(projectId));
  const filePath = (projectId: string, hours: number, sha256: string) => {
    if (![1, 12, 24].includes(hours) || !/^[a-f0-9]{64}$/.test(sha256))
      throw new Error("Invalid recovery file reference");
    return join(projectPath(projectId), String(hours), `${sha256}.json.gz`);
  };
  return {
    directory: (projectId: string) => (root ? projectPath(projectId) : undefined),
    async put(projectId: string, hours: number, prepared: PreparedRecoveryBytes) {
      const { data: bytes, ...reference } = prepared;
      if (!root) {
        memory.set(address(projectId, hours, reference.sha256), bytes);
        return reference;
      }
      const file = filePath(projectId, hours, reference.sha256);
      const existing = await readFile(file).catch((error) => {
        if (!missing(error)) throw error;
      });
      if (existing && existing.length === reference.bytes && hash(existing) === reference.sha256) {
        // A prior process may have stopped after rename but before flushing this entry.
        await ensureDirectory(dirname(file));
        return reference;
      }
      await ensureDirectory(dirname(file));
      const temporary = `${file}.${randomUUID()}.tmp`;
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, file);
      await flushDirectory(dirname(file));
      return reference;
    },
    async read(projectId: string, hours: number, reference: RecoveryReference) {
      const bytes = root
        ? await readFile(filePath(projectId, hours, reference.sha256))
        : memory.get(address(projectId, hours, reference.sha256));
      if (!bytes) throw new Error("The saved recovery file is missing");
      verify(bytes, reference);
      const value = JSON.parse((await decompress(bytes)).toString()) as { records?: unknown; metadata?: unknown };
      if (typeof value.records !== "string" || typeof value.metadata !== "string")
        throw new Error("Invalid saved recovery file");
      const records = Buffer.from(value.records, "base64");
      const metadata = Buffer.from(value.metadata, "base64");
      if (records.toString("base64") !== value.records || metadata.toString("base64") !== value.metadata)
        throw new Error("Invalid saved recovery bytes");
      return { records, metadata };
    },
    async *projects() {
      if (!root) {
        const projects = new Set([...memory.keys()].map((key) => (JSON.parse(key) as [string])[0]));
        yield* projects;
        return;
      }
      for await (const entry of entries(root)) {
        if (!entry.isDirectory() || !/^p-(?:[a-f0-9]{2})*$/.test(entry.name)) continue;
        const projectId = Buffer.from(entry.name.slice(2), "hex").toString();
        if (projectSegment(projectId) === entry.name) yield projectId;
      }
    },
    // Every caller holds the database transaction queue through file collection, so
    // another writer cannot create an unreferenced file between this read and removal.
    async retain(projectId: string, references: Map<number, Set<string>>) {
      if (!root) {
        retainMemory(memory, projectId, references);
        return;
      }
      const project = projectPath(projectId);
      let kept = false;
      for await (const slot of entries(project)) {
        const retained = references.get(Number(slot.name)) ?? new Set<string>();
        if (!slot.isDirectory()) {
          await rm(join(project, slot.name), { force: true });
          continue;
        }
        if (await retainSlot(join(project, slot.name), retained)) kept = true;
      }
      if (!kept)
        await rmdir(project).catch((error) => {
          if (!missing(error)) throw error;
        });
    },
  };
};

const attached = new WeakMap<DbClient, ReturnType<typeof createRecoveryFiles>>();
export const recoveryFilesFor = (db: DbClient, database?: string) => {
  let files = attached.get(db);
  if (!files && database !== undefined) {
    files = createRecoveryFiles(database === ":memory:" ? undefined : `${database}-recovery`);
    attached.set(db, files);
  }
  if (!files) throw new Error("Recovery files are not attached to this database");
  return files;
};
