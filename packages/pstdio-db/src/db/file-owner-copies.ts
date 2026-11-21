import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { constants, copyFile, link, mkdir, open, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readFileOwnerExport, writeFileOwnerExport } from "./file-owner-exports";
import { flushDirectory } from "./pglite-home-recovery";

export const fileOwnerUuid = (key: string) => {
  const bytes = createHash("sha256").update(`file-owner:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const fingerprint = async (path: string) => {
  const hash = createHash("sha256");
  let size = 0;
  try {
    for await (const chunk of createReadStream(path)) {
      hash.update(chunk);
      size += chunk.length;
    }
    return { sha256: hash.digest("hex"), size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
const storedFingerprint = (value: unknown) => {
  if (value === null) return null;
  const row = value as { sha256?: unknown; size?: unknown } | undefined;
  if (
    !row ||
    typeof row.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.sha256) ||
    typeof row.size !== "number" ||
    !Number.isSafeInteger(row.size) ||
    row.size < 0
  )
    throw new Error("Invalid file migration fingerprint.");
  return { sha256: row.sha256, size: row.size };
};
type FileMetadata = { id: string; storage_path: string; size_bytes: number; hash: string | null };
const prepareCopy = async (
  database: string,
  id: string,
  source: FileMetadata,
  identity: { owner: string; scope: string | null; path: string | null },
  target: string,
) => {
  const observed = await fingerprint(source.storage_path);
  if (observed && (observed.size !== source.size_bytes || (source.hash && source.hash !== observed.sha256)))
    throw new Error(`Original file bytes do not match metadata: ${source.id}`);
  const allocated = await readFileOwnerExport(database, "allocations", id);
  const allocationIdentity = { id, source, ...identity, target };
  if (allocated) {
    const { expected, ...previous } = allocated;
    if (!isDeepStrictEqual(previous, allocationIdentity)) throw new Error(`File migration allocation collision: ${id}`);
  } else if (await fingerprint(target)) throw new Error(`File migration path is occupied: ${target}`);
  const expected = allocated ? storedFingerprint(allocated.expected) : observed;
  if (observed && (!expected || observed.sha256 !== expected.sha256 || observed.size !== expected.size))
    throw new Error(`Original file changed during conversion: ${source.id}`);
  await writeFileOwnerExport(database, "allocations", id, { ...allocationIdentity, expected });
  return { expected, observed };
};

export const copyFileOwnerBytes = async (
  database: string,
  id: string,
  source: FileMetadata,
  identity: { owner: string; scope: string | null; path: string | null },
) => {
  if (database === ":memory:") throw new Error("Legacy file copies require a durable database directory.");
  const root = `${database}-owned-files`;
  const target = join(root, id);
  const { expected, observed } = await prepareCopy(database, id, source, identity, target);
  if (!expected) {
    if (await fingerprint(target)) throw new Error(`Unexpected bytes for a missing file: ${target}`);
    return target;
  }
  const existing = await fingerprint(target);
  if (existing) {
    if (existing.sha256 !== expected.sha256 || existing.size !== expected.size)
      throw new Error(`File migration content collision: ${target}`);
    return target;
  }
  if (!observed) throw new Error(`Original file disappeared before its copy committed: ${source.id}`);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await flushDirectory(dirname(root));
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await copyFile(source.storage_path, temporary, constants.COPYFILE_EXCL);
    const file = await open(temporary, "r");
    try {
      await file.sync();
    } finally {
      await file.close();
    }
    const copied = await fingerprint(temporary);
    if (copied?.sha256 !== expected.sha256 || copied.size !== expected.size)
      throw new Error(`File changed while copying: ${source.id}`);
    await link(temporary, target);
    await flushDirectory(root);
  } finally {
    await rm(temporary, { force: true });
    await flushDirectory(root);
  }
  return target;
};

export const cleanFileOwnerStaging = async (database: string) => {
  if (database === ":memory:") return;
  const root = `${database}-owned-files`;
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isFile() && /^[a-f0-9-]{36}\.[a-f0-9-]{36}\.tmp$/.test(entry.name)) await rm(join(root, entry.name));
    }
    await flushDirectory(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};
