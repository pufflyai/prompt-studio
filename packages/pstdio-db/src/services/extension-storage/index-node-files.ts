import { link, mkdir, open, readdir, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StorageOwner } from "pstdio-sync";
import { type OrderedIndexReference, readOrderedIndexReference } from "pstdio-sync/relay";
import type { DbClient } from "../../db/connection.pglite";
import { flushDirectory } from "../../db/pglite-home-recovery";

/**
 * Encrypted index nodes live in files, never in the database (rule 0006.2.16).
 * `receipts` nodes are the full writer's durable copy of its receipt index: they must survive
 * a crash once a saved root names them, so their writes are flushed before they return.
 * `logs` nodes cache relay data for log and history indexes and can always be fetched again.
 */
export type IndexNodeKind = "receipts" | "logs";

export interface IndexNode {
  bytes: Uint8Array;
  /** Null until the node's edges are validated; a null node is a leaf for traversal. */
  children: OrderedIndexReference[] | null;
}

export interface IndexNodeFiles {
  read(owner: StorageOwner, kind: IndexNodeKind, id: string): Promise<IndexNode | undefined>;
  /** Reads only a node's edges, or undefined when the node is missing or unreadable. */
  edges(owner: StorageOwner, kind: IndexNodeKind, id: string): Promise<IndexNode["children"] | undefined>;
  /** Adds a node unless one exists; never replaces edges another writer already recorded. */
  create(owner: StorageOwner, kind: IndexNodeKind, id: string, node: IndexNode): Promise<void>;
  /** Replaces a node, for recording validated edges. */
  write(owner: StorageOwner, kind: IndexNodeKind, id: string, node: IndexNode): Promise<void>;
  list(owner: StorageOwner, kind: IndexNodeKind): Promise<string[]>;
  remove(owner: StorageOwner, kind: IndexNodeKind, ids: Iterable<string>): Promise<void>;
  /** Removes the least recently read cache nodes until the owner's cache fits `budgetBytes`. */
  evict(owner: StorageOwner, kind: IndexNodeKind, budgetBytes: number, keepNewerThanMs: number): Promise<number>;
  removeOwner(owner: StorageOwner): Promise<void>;
  /** Moves every project's nodes to a renamed extension id; nodes the target already has win. */
  moveExtension(from: string, to: string): Promise<void>;
  /** Whether any project keeps nodes under this extension id. */
  hasExtension(extensionId: string): Promise<boolean>;
  /** Removes every project folder whose id is not in `projectIds`. */
  retainProjects(projectIds: ReadonlySet<string>): Promise<void>;
}

/** Child order matches the relay's stored order: plain code-unit order, never locale order. */
export const sortIndexChildren = <T extends { blobId: string }>(children: readonly T[]) =>
  [...children].sort((a, b) => {
    if (a.blobId === b.blobId) return 0;
    return a.blobId < b.blobId ? -1 : 1;
  });

const segment = (value: string) => Buffer.from(value).toString("base64url");
const unsegment = (value: string) => Buffer.from(value, "base64url").toString();
// Hex keeps distinct base64url ids distinct on case-insensitive file systems.
const fileName = (id: string) => Buffer.from(id).toString("hex");
const idOf = (name: string) => Buffer.from(name, "hex").toString();

const encode = (node: IndexNode) => {
  const header = Buffer.from(JSON.stringify({ version: 1, children: node.children }));
  const length = Buffer.alloc(4);
  length.writeUInt32LE(header.byteLength);
  return Buffer.concat([length, header, node.bytes]);
};

const decodeHeader = (header: Buffer) => {
  const value = JSON.parse(header.toString()) as { version: number; children: unknown };
  if (value.version !== 1 || (value.children !== null && !Array.isArray(value.children)))
    throw new Error("Invalid index node file");
  return value.children === null ? null : (value.children as unknown[]).map(readOrderedIndexReference);
};

const decode = (file: Buffer): IndexNode => {
  const length = file.readUInt32LE(0);
  if (4 + length > file.byteLength) throw new RangeError("Truncated index node file");
  return { children: decodeHeader(file.subarray(4, 4 + length)), bytes: new Uint8Array(file.subarray(4 + length)) };
};

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const exists = (error: unknown) => (error as NodeJS.ErrnoException).code === "EEXIST";

export const createIndexNodeFiles = (root: string): IndexNodeFiles => {
  const ownerDirectory = (owner: StorageOwner) => join(root, segment(owner.workbenchId), segment(owner.extensionId));
  const kindDirectory = (owner: StorageOwner, kind: IndexNodeKind) => join(ownerDirectory(owner), kind);
  const path = (owner: StorageOwner, kind: IndexNodeKind, id: string) => {
    const name = fileName(id);
    return join(kindDirectory(owner, kind), name.slice(0, 2), name);
  };
  const files = async (directory: string) => {
    const found: { id: string; path: string }[] = [];
    for (const shard of await readdir(directory).catch(() => [] as string[])) {
      for (const name of await readdir(join(directory, shard)).catch(() => [] as string[])) {
        if (!name.endsWith(".tmp")) found.push({ id: idOf(name), path: join(directory, shard, name) });
      }
    }
    return found;
  };
  // A torn or damaged file is a missing node: receipts are fetched or refounded, logs download again.
  const unreadable = async (file: string, error: unknown) => {
    if (missing(error)) return undefined;
    const damaged =
      error instanceof RangeError ||
      error instanceof SyntaxError ||
      String((error as Error).message).includes("index node");
    if (!damaged) throw error;
    await rm(file, { force: true });
    return undefined;
  };
  const directories = new Set<string>();
  // Receipt folders are flushed level by level, so a crash cannot drop a new folder with its files.
  const ensureDirectory = async (directory: string, durable: boolean) => {
    if (directories.has(directory)) return;
    const created = await mkdir(directory, { recursive: true });
    if (durable && created) {
      const levels: string[] = [];
      for (let level = directory; level !== dirname(created); level = dirname(level)) levels.push(level);
      for (const level of levels.reverse()) await flushDirectory(dirname(level));
    }
    directories.add(directory);
  };
  const stage = async (kind: IndexNodeKind, file: string, node: IndexNode) => {
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    await ensureDirectory(dirname(file), kind === "receipts");
    const handle = await open(temporary, "w");
    try {
      await handle.writeFile(encode(node));
      if (kind === "receipts") await handle.sync();
    } catch (error) {
      await handle.close();
      await rm(temporary, { force: true });
      throw error;
    }
    await handle.close();
    return temporary;
  };
  const publish = async (kind: IndexNodeKind, file: string, temporary: string, replace: boolean) => {
    try {
      if (replace) await rename(temporary, file);
      else await link(temporary, file);
    } catch (error) {
      if (replace || !exists(error)) throw error;
    } finally {
      await rm(temporary, { force: true });
    }
    if (kind === "receipts") await flushDirectory(dirname(file));
  };
  return {
    async read(owner, kind, id) {
      const file = path(owner, kind, id);
      try {
        const node = decode(await readFile(file));
        // Reading refreshes the cache's recency, so eviction removes the least recently used nodes.
        if (kind === "logs") await utimes(file, new Date(), new Date()).catch(() => undefined);
        return node;
      } catch (error) {
        return unreadable(file, error);
      }
    },
    async edges(owner, kind, id) {
      const file = path(owner, kind, id);
      try {
        const handle = await open(file, "r");
        try {
          const length = Buffer.alloc(4);
          if ((await handle.read(length, 0, 4, 0)).bytesRead !== 4) throw new RangeError("Truncated index node file");
          const header = Buffer.alloc(length.readUInt32LE(0));
          if ((await handle.read(header, 0, header.byteLength, 4)).bytesRead !== header.byteLength)
            throw new RangeError("Truncated index node file");
          return decodeHeader(header);
        } finally {
          await handle.close();
        }
      } catch (error) {
        return unreadable(file, error);
      }
    },
    async create(owner, kind, id, node) {
      const file = path(owner, kind, id);
      if (kind === "receipts") return publish(kind, file, await stage(kind, file, node), false);
      // A cache node needs no staging: a torn file reads as missing and is downloaded again.
      await ensureDirectory(dirname(file), false);
      await writeFile(file, encode(node), { flag: "wx" }).catch((error) => {
        if (!exists(error)) throw error;
      });
    },
    async write(owner, kind, id, node) {
      const file = path(owner, kind, id);
      await publish(kind, file, await stage(kind, file, node), true);
    },
    list: async (owner, kind) => (await files(kindDirectory(owner, kind))).map((file) => file.id),
    async remove(owner, kind, ids) {
      for (const id of ids) await rm(path(owner, kind, id), { force: true });
    },
    async evict(owner, kind, budgetBytes, keepNewerThanMs) {
      const entries = await Promise.all(
        (await files(kindDirectory(owner, kind))).map(async (file) => {
          const info = await stat(file.path).catch(() => null);
          return info && { ...file, bytes: info.size, used: info.mtimeMs };
        }),
      );
      const present = entries.filter((entry) => entry !== null).sort((a, b) => a.used - b.used);
      let total = present.reduce((sum, entry) => sum + entry.bytes, 0);
      const cutoff = Date.now() - keepNewerThanMs;
      let removed = 0;
      for (const entry of present) {
        if (total <= budgetBytes || entry.used > cutoff) break;
        // A read since the listing makes the node recent again; keep it.
        const current = await stat(entry.path).catch(() => null);
        if (current && current.mtimeMs !== entry.used) continue;
        await rm(entry.path, { force: true });
        total -= entry.bytes;
        removed++;
      }
      return removed;
    },
    async removeOwner(owner) {
      directories.clear();
      await rm(ownerDirectory(owner), { recursive: true, force: true });
    },
    async moveExtension(from, to) {
      for (const project of await readdir(root).catch(() => [] as string[])) {
        if (project.startsWith(".")) continue;
        const source = join(root, project, segment(from));
        const target = join(root, project, segment(to));
        for (const kind of ["receipts", "logs"] as const) {
          for (const file of await files(join(source, kind))) {
            const name = fileName(file.id);
            const destination = join(target, kind, name.slice(0, 2), name);
            await ensureDirectory(dirname(destination), kind === "receipts");
            await link(file.path, destination).catch((error) => {
              if (!exists(error)) throw error;
            });
            if (kind === "receipts") await flushDirectory(dirname(destination));
          }
        }
        await rm(source, { recursive: true, force: true });
      }
      directories.clear();
    },
    async hasExtension(extensionId) {
      for (const project of await readdir(root).catch(() => [] as string[])) {
        if (await stat(join(root, project, segment(extensionId))).catch(() => null)) return true;
      }
      return false;
    },
    async retainProjects(projectIds) {
      for (const name of await readdir(root).catch(() => [] as string[])) {
        if (name.startsWith(".")) continue;
        if (!projectIds.has(unsegment(name))) await rm(join(root, name), { recursive: true, force: true });
      }
      directories.clear();
    },
  };
};

/** In-memory databases keep their index nodes in memory too. */
export const createMemoryIndexNodeFiles = (): IndexNodeFiles => {
  const nodes = new Map<string, { node: IndexNode; used: number }>();
  const key = (owner: StorageOwner, kind: IndexNodeKind, id: string) =>
    JSON.stringify([owner.workbenchId, owner.extensionId, kind, id]);
  const parse = (entry: string) => JSON.parse(entry) as [string, string, IndexNodeKind, string];
  const select = (match: (parts: ReturnType<typeof parse>) => boolean) =>
    [...nodes.keys()].filter((entry) => match(parse(entry)));
  const of = (owner: StorageOwner, kind?: IndexNodeKind) =>
    select(([w, e, k]) => w === owner.workbenchId && e === owner.extensionId && (!kind || k === kind));
  let clock = 0;
  const copy = (node: IndexNode) => ({ bytes: node.bytes.slice(), children: node.children && [...node.children] });
  return {
    async read(owner, kind, id) {
      const entry = nodes.get(key(owner, kind, id));
      if (!entry) return undefined;
      entry.used = ++clock;
      return copy(entry.node);
    },
    edges: async (owner, kind, id) => {
      const entry = nodes.get(key(owner, kind, id));
      return entry && copy(entry.node).children;
    },
    async create(owner, kind, id, node) {
      if (!nodes.has(key(owner, kind, id))) nodes.set(key(owner, kind, id), { node: copy(node), used: ++clock });
    },
    async write(owner, kind, id, node) {
      nodes.set(key(owner, kind, id), { node: copy(node), used: ++clock });
    },
    list: async (owner, kind) => of(owner, kind).map((entry) => parse(entry)[3]),
    async remove(owner, kind, ids) {
      for (const id of ids) nodes.delete(key(owner, kind, id));
    },
    async evict(owner, kind, budgetBytes) {
      const entries = of(owner, kind).sort((a, b) => nodes.get(a)!.used - nodes.get(b)!.used);
      let total = entries.reduce((sum, entry) => sum + nodes.get(entry)!.node.bytes.byteLength, 0);
      let removed = 0;
      for (const entry of entries) {
        if (total <= budgetBytes) break;
        total -= nodes.get(entry)!.node.bytes.byteLength;
        nodes.delete(entry);
        removed++;
      }
      return removed;
    },
    async removeOwner(owner) {
      for (const entry of of(owner)) nodes.delete(entry);
    },
    async moveExtension(from, to) {
      for (const entry of select(([, e]) => e === from)) {
        const [workbenchId, , kind, id] = parse(entry);
        const target = key({ workbenchId, extensionId: to }, kind, id);
        if (!nodes.has(target)) nodes.set(target, nodes.get(entry)!);
        nodes.delete(entry);
      }
    },
    hasExtension: async (extensionId) => select(([, e]) => e === extensionId).length > 0,
    async retainProjects(projectIds) {
      for (const entry of select(([w]) => !projectIds.has(w))) nodes.delete(entry);
    },
  };
};

const attached = new WeakMap<DbClient, IndexNodeFiles>();

/** `createDb` attaches the folder that belongs to its database; every storage service shares it. */
export const attachIndexNodeFiles = (db: DbClient, files: IndexNodeFiles) => {
  attached.set(db, files);
};

export const indexNodeFilesFor = (db: DbClient) => {
  const files = attached.get(db);
  if (!files) throw new Error("Index node files are not attached to this database");
  return files;
};
