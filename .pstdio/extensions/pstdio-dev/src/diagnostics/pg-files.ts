import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// Reads PGlite's Postgres data directory without opening the database, so a running
// runtime keeps its exclusive lock. Offsets follow the Postgres 17 on-disk catalog layout.
const PAGE = 8192;
const CHUNK = 128 * PAGE;
const PG_CLASS_OID = 1259;
const CLASS = { relname: 4, relfilenode: 88, reltoastrelid: 108, relkind: 115 };
const XMIN_COMMITTED = 0x0100;
const XMIN_INVALID = 0x0200;
const XMAX_LOCK_ONLY = 0x0080;
const XMAX_INVALID = 0x0800;
const XMAX_IS_MULTI = 0x1000;
const XACT_SEGMENT_XIDS = 32 * PAGE * 4;

interface ClassRow {
  oid: number;
  name: string;
  filenode: number;
  toastOid: number;
  kind: string;
}

export interface TableSize {
  name: string;
  heapBytes: number;
  largeValueBytes: number;
  indexBytes: number;
  totalBytes: number;
}

export interface DocumentGroup {
  owner: string;
  kind: string;
  rows: number;
  liveBytes: number;
  deadBytes: number;
  unknownBytes?: number;
}

const yieldToRuntime = () => new Promise((resolve) => setTimeout(resolve, 0));

const relationFiles = async (dir: string, filenode: number) => {
  const names = (await readdir(dir)).filter((name) => name === String(filenode) || name.startsWith(`${filenode}.`));
  return names
    .sort((a, b) => Number(a.split(".")[1] ?? 0) - Number(b.split(".")[1] ?? 0))
    .map((name) => join(dir, name));
};

/** Visits every line pointer that holds a tuple, page by page, across all segments. */
const scanTuples = async (
  files: string[],
  visit: (page: DataView, bytes: Uint8Array, offset: number, length: number) => void,
) => {
  for (const file of files) {
    const relation = Bun.file(file);
    const size = relation.size;
    for (let chunk = 0; chunk < size; chunk += CHUNK) {
      const bytes = new Uint8Array(await relation.slice(chunk, Math.min(size, chunk + CHUNK)).arrayBuffer());
      for (let start = 0; start + PAGE <= bytes.length; start += PAGE) {
        const page = new DataView(bytes.buffer, start, PAGE);
        const lower = page.getUint16(12, true);
        for (let pointer = 24; pointer + 4 <= lower && pointer < PAGE; pointer += 4) {
          const value = page.getUint32(pointer, true);
          const offset = value & 0x7fff;
          const flags = (value >>> 15) & 3;
          const length = value >>> 17;
          if (flags === 1 && offset + length <= PAGE) visit(page, bytes.subarray(start, start + PAGE), offset, length);
        }
      }
      await yieldToRuntime();
    }
  }
};

const cString = (bytes: Uint8Array, from: number, to: number) => {
  const end = bytes.indexOf(0, from);
  return new TextDecoder().decode(bytes.subarray(from, end === -1 || end > to ? to : end));
};

export const findDatabaseDirectory = async (dataDir: string) => {
  const version = await Bun.file(join(dataDir, "PG_VERSION")).text();
  if (version.trim() !== "17") throw new Error("Storage diagnostics support PostgreSQL 17 data files.");
  const base = join(dataDir, "base");
  let best: { dir: string; bytes: number } | null = null;
  for (const name of await readdir(base)) {
    const dir = join(base, name);
    if (!(await Bun.file(join(dir, "pg_filenode.map")).exists())) continue;
    let bytes = 0;
    for (const file of await readdir(dir)) bytes += (await stat(join(dir, file))).size;
    if (!best || bytes > best.bytes) best = { dir, bytes };
  }
  if (!best) throw new Error(`No database found under ${base}.`);
  return best.dir;
};

const readCatalog = async (dir: string) => {
  const map = new DataView(await Bun.file(join(dir, "pg_filenode.map")).arrayBuffer());
  const mappings = map.getUint32(4, true);
  let classFilenode = 0;
  for (let index = 0; index < mappings; index++) {
    if (map.getUint32(8 + index * 8, true) === PG_CLASS_OID) classFilenode = map.getUint32(12 + index * 8, true);
  }
  if (!classFilenode) throw new Error("pg_class is missing from pg_filenode.map.");
  const present = new Set((await readdir(dir)).map((name) => Number(name.split(/[._]/)[0])));
  const byOid = new Map<number, ClassRow>();
  await scanTuples(await relationFiles(dir, classFilenode), (page, bytes, offset, length) => {
    if (length < 120) return;
    const data = offset + bytes[offset + 22]!;
    const row: ClassRow = {
      oid: page.getUint32(data, true),
      name: cString(bytes, data + CLASS.relname, data + CLASS.relname + 64),
      filenode: page.getUint32(data + CLASS.relfilenode, true),
      toastOid: page.getUint32(data + CLASS.reltoastrelid, true),
      kind: String.fromCharCode(bytes[data + CLASS.relkind]!),
    };
    // Rewrites leave older catalog rows behind; the row whose file exists is current.
    const known = byOid.get(row.oid);
    if (!known || (!present.has(known.filenode) && present.has(row.filenode))) byOid.set(row.oid, row);
  });
  // pg_index is not a mapped catalog, so it is found through pg_class.
  const indexRow = [...byOid.values()].find((row) => row.name === "pg_index" && row.kind === "r");
  const indexOwner = new Map<number, number>();
  if (indexRow) {
    await scanTuples(await relationFiles(dir, indexRow.filenode), (page, bytes, offset) => {
      const data = offset + bytes[offset + 22]!;
      indexOwner.set(page.getUint32(data, true), page.getUint32(data + 4, true));
    });
  }
  return { byOid, indexOwner, classFilenode };
};

/** Attributes every relation file to its table: heap, out-of-line large values (TOAST), and indexes. */
export const readTableSizes = async (dir: string) => {
  const { byOid, indexOwner } = await readCatalog(dir);
  const byFilenode = new Map([...byOid.values()].map((row) => [row.filenode, row]));
  const toastParent = new Map([...byOid.values()].filter((row) => row.toastOid).map((row) => [row.toastOid, row]));
  const tables = new Map<string, TableSize>();
  const tableOf = (row: ClassRow): { table: ClassRow; part: "heap" | "large" | "index" } | null => {
    if (row.kind === "t") {
      const parent = toastParent.get(row.oid);
      return parent ? { table: parent, part: "large" } : null;
    }
    if (row.kind === "i") {
      const owner = byOid.get(indexOwner.get(row.oid) ?? -1);
      if (!owner) return null;
      const resolved = tableOf(owner);
      return resolved && { table: resolved.table, part: resolved.part === "large" ? "large" : "index" };
    }
    return { table: row, part: "heap" };
  };
  for (const name of await readdir(dir)) {
    const filenode = Number(name.split(/[._]/)[0]);
    if (!Number.isFinite(filenode) || !/^\d/.test(name)) continue;
    const { size } = await stat(join(dir, name));
    const row = byFilenode.get(filenode);
    const resolved = row ? tableOf(row) : null;
    const key = resolved?.table.name ?? "(unattributed)";
    const entry = tables.get(key) ?? { name: key, heapBytes: 0, largeValueBytes: 0, indexBytes: 0, totalBytes: 0 };
    if (resolved?.part === "large") entry.largeValueBytes += size;
    else if (resolved?.part === "index") entry.indexBytes += size;
    else entry.heapBytes += size;
    entry.totalBytes += size;
    tables.set(key, entry);
  }
  return { tables: [...tables.values()].sort((a, b) => b.totalBytes - a.totalBytes), byOid };
};

const createCommitLog = (dataDir: string) => {
  const segments = new Map<number, Uint8Array | null>();
  const load = async (xid: number) => {
    const segment = Math.floor(xid / XACT_SEGMENT_XIDS);
    if (segments.has(segment)) return;
    const file = Bun.file(join(dataDir, "pg_xact", segment.toString(16).toUpperCase().padStart(4, "0")));
    segments.set(segment, (await file.exists()) ? new Uint8Array(await file.arrayBuffer()) : null);
  };
  const status = (xid: number) => {
    const bytes = segments.get(Math.floor(xid / XACT_SEGMENT_XIDS));
    const within = xid % XACT_SEGMENT_XIDS;
    return bytes ? (bytes[within >> 2]! >> ((within & 3) * 2)) & 3 : 0;
  };
  return { load, committed: (xid: number) => status(xid) === 1, aborted: (xid: number) => status(xid) === 2 };
};

/** Reads one varlena value; returns its stored size and, for inline text, its value. */
const readVarlena = (page: DataView, bytes: Uint8Array, at: number) => {
  const first = bytes[at]!;
  if (first === 0x01) return { size: page.getUint32(at + 6, true) & 0x3fffffff, end: at + 18, text: null };
  if (first & 1) {
    const length = first >> 1;
    return { size: length, end: at + length, text: new TextDecoder().decode(bytes.subarray(at + 1, at + length)) };
  }
  const aligned = (at + 3) & ~3;
  const header = page.getUint32(aligned, true);
  const length = header >>> 2;
  // Low bits 10 mark an inline pglz-compressed value: its bytes are not text.
  const compressed = (header & 3) === 2;
  return {
    size: length,
    end: aligned + length,
    text: compressed ? "(compressed)" : new TextDecoder().decode(bytes.subarray(aligned + 4, aligned + length)),
  };
};

const firstSegment = (value: string) => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? String(parsed[0]) : value;
  } catch {
    return value;
  }
};

/** Groups `storage_documents` state bytes by owner and document kind, live versus dead. */
export const readDocumentGroups = async (dataDir: string, dir: string, byOid: Map<number, ClassRow>) => {
  const table = [...byOid.values()].find((row) => row.name === "storage_documents" && row.kind === "r");
  if (!table) return [];
  const commits = createCommitLog(dataDir);
  const tuples: { xmin: number; xmax: number; mask: number; owner: string; kind: string; size: number }[] = [];
  await scanTuples(await relationFiles(dir, table.filenode), (page, bytes, offset) => {
    try {
      const workbench = readVarlena(page, bytes, offset + bytes[offset + 22]!);
      const extension = readVarlena(page, bytes, workbench.end);
      const document = readVarlena(page, bytes, extension.end);
      const state = readVarlena(page, bytes, document.end);
      tuples.push({
        xmin: page.getUint32(offset, true),
        xmax: page.getUint32(offset + 4, true),
        mask: page.getUint16(offset + 20, true),
        owner: firstSegment(extension.text ?? "?"),
        kind: firstSegment(document.text ?? "?"),
        size: state.size,
      });
    } catch {
      // A page written while it is read can be torn; skip the tuple rather than guess.
    }
  });
  for (const tuple of tuples) {
    await commits.load(tuple.xmin);
    if (tuple.xmax) await commits.load(tuple.xmax);
  }
  const groups = new Map<string, DocumentGroup>();
  for (const tuple of tuples) {
    const inserted = Boolean(tuple.mask & XMIN_COMMITTED) || tuple.xmin === 2 || commits.committed(tuple.xmin);
    const insertFailed = !(tuple.mask & XMIN_COMMITTED) && (tuple.mask & XMIN_INVALID || commits.aborted(tuple.xmin));
    const removed =
      !(tuple.mask & (XMAX_INVALID | XMAX_LOCK_ONLY | XMAX_IS_MULTI)) &&
      tuple.xmax !== 0 &&
      commits.committed(tuple.xmax);
    const key = `${tuple.owner}\u0000${tuple.kind}`;
    const group = groups.get(key) ?? { owner: tuple.owner, kind: tuple.kind, rows: 0, liveBytes: 0, deadBytes: 0 };
    group.rows++;
    if (insertFailed || removed) group.deadBytes += tuple.size;
    else if (inserted) group.liveBytes += tuple.size;
    else group.unknownBytes = (group.unknownBytes ?? 0) + tuple.size;
    groups.set(key, group);
  }
  const total = (group: DocumentGroup) => group.liveBytes + group.deadBytes + (group.unknownBytes ?? 0);
  return [...groups.values()].sort((a, b) => total(b) - total(a));
};
