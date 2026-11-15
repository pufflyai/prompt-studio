import { mkdir, open, readdir, readFile, rename, rm, stat, utimes } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StorageOwner } from "pstdio-sync";
import { type OrderedIndexReference, readOrderedIndexReference } from "pstdio-sync/relay";
import type { DbClient } from "../../db/connection.pglite";

/**
 * Encrypted index nodes live in files, never in the database (rule 0006.2.15).
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
  write(owner: StorageOwner, kind: IndexNodeKind, id: string, node: IndexNode): Promise<void>;
  list(owner: StorageOwner, kind: IndexNodeKind): Promise<string[]>;
  remove(owner: StorageOwner, kind: IndexNodeKind, ids: Iterable<string>): Promise<void>;
  /** Removes the oldest unread cache nodes until the owner's cache fits `budgetBytes`. */
  evict(owner: StorageOwner, kind: IndexNodeKind, budgetBytes: number, keepNewerThanMs: number): Promise<number>;
  removeOwner(owner: StorageOwner): Promise<void>;
  /** Moves an owner's nodes after its rows moved to a new extension id; an existing target wins. */
  moveOwner(from: StorageOwner, to: StorageOwner): Promise<void>;
  /** Removes every project folder whose id is not in `projectIds`. */
  retainProjects(projectIds: ReadonlySet<string>): Promise<void>;
  /** A durable flag for resumable maintenance, such as an unfinished upgrade. */
  marker(name: string): { exists(): Promise<boolean>; set(): Promise<void>; clear(): Promise<void> };
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

const decode = (file: Buffer): IndexNode => {
  const length = file.readUInt32LE(0);
  const header = JSON.parse(file.subarray(4, 4 + length).toString()) as { version: number; children: unknown };
  if (header.version !== 1 || (header.children !== null && !Array.isArray(header.children)))
    throw new Error("Invalid index node file");
  return {
    bytes: new Uint8Array(file.subarray(4 + length)),
    children: header.children === null ? null : (header.children as unknown[]).map(readOrderedIndexReference),
  };
};

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

export const createIndexNodeFiles = (root: string): IndexNodeFiles => {
  const ownerDirectory = (owner: StorageOwner) => join(root, segment(owner.workbenchId), segment(owner.extensionId));
  const kindDirectory = (owner: StorageOwner, kind: IndexNodeKind) => join(ownerDirectory(owner), kind);
  const path = (owner: StorageOwner, kind: IndexNodeKind, id: string) => {
    const name = fileName(id);
    return join(kindDirectory(owner, kind), name.slice(0, 2), name);
  };
  const files = async (owner: StorageOwner, kind: IndexNodeKind) => {
    const found: { id: string; path: string }[] = [];
    const directory = kindDirectory(owner, kind);
    for (const shard of await readdir(directory).catch(() => [] as string[])) {
      for (const name of await readdir(join(directory, shard)).catch(() => [] as string[])) {
        if (!name.endsWith(".tmp")) found.push({ id: idOf(name), path: join(directory, shard, name) });
      }
    }
    return found;
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
        if (missing(error)) return undefined;
        throw error;
      }
    },
    async write(owner, kind, id, node) {
      const file = path(owner, kind, id);
      const temporary = `${file}.${crypto.randomUUID()}.tmp`;
      await mkdir(dirname(file), { recursive: true });
      const handle = await open(temporary, "w");
      try {
        await handle.writeFile(encode(node));
        if (kind === "receipts") await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, file);
    },
    list: async (owner, kind) => (await files(owner, kind)).map((file) => file.id),
    async remove(owner, kind, ids) {
      for (const id of ids) await rm(path(owner, kind, id), { force: true });
    },
    async evict(owner, kind, budgetBytes, keepNewerThanMs) {
      const entries = await Promise.all(
        (await files(owner, kind)).map(async (file) => {
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
        await rm(entry.path, { force: true });
        total -= entry.bytes;
        removed++;
      }
      return removed;
    },
    removeOwner: (owner) => rm(ownerDirectory(owner), { recursive: true, force: true }),
    async moveOwner(from, to) {
      const target = ownerDirectory(to);
      if (await stat(target).catch(() => null)) return;
      await mkdir(dirname(target), { recursive: true });
      await rename(ownerDirectory(from), target).catch((error) => {
        if (!missing(error)) throw error;
      });
    },
    async retainProjects(projectIds) {
      for (const name of await readdir(root).catch(() => [] as string[])) {
        if (name.startsWith(".")) continue;
        if (!projectIds.has(unsegment(name))) await rm(join(root, name), { recursive: true, force: true });
      }
    },
    marker(name) {
      const file = join(root, `.${name}`);
      return {
        exists: async () => !!(await stat(file).catch(() => null)),
        async set() {
          await mkdir(root, { recursive: true });
          const handle = await open(file, "w");
          await handle.sync();
          await handle.close();
        },
        clear: () => rm(file, { force: true }),
      };
    },
  };
};

/** Test and tool databases without a host storage folder keep index nodes in memory. */
export const createMemoryIndexNodeFiles = (): IndexNodeFiles => {
  const nodes = new Map<string, { node: IndexNode; used: number }>();
  const ownerKey = (owner: StorageOwner) => JSON.stringify([owner.workbenchId, owner.extensionId]);
  const prefix = (owner: StorageOwner, kind: IndexNodeKind) => `${ownerKey(owner).slice(0, -1)},"${kind}",`;
  const key = (owner: StorageOwner, kind: IndexNodeKind, id: string) => `${prefix(owner, kind)}${JSON.stringify(id)}]`;
  const keys = (start: string) => [...nodes.keys()].filter((entry) => entry.startsWith(start));
  let clock = 0;
  const markers = new Set<string>();
  const copy = (node: IndexNode) => ({ bytes: node.bytes.slice(), children: node.children && [...node.children] });
  return {
    async read(owner, kind, id) {
      const entry = nodes.get(key(owner, kind, id));
      if (!entry) return undefined;
      entry.used = ++clock;
      return copy(entry.node);
    },
    async write(owner, kind, id, node) {
      nodes.set(key(owner, kind, id), { node: copy(node), used: ++clock });
    },
    list: async (owner, kind) => keys(prefix(owner, kind)).map((entry) => (JSON.parse(entry) as string[])[3]!),
    async remove(owner, kind, ids) {
      for (const id of ids) nodes.delete(key(owner, kind, id));
    },
    async evict(owner, kind, budgetBytes) {
      const entries = keys(prefix(owner, kind)).sort((a, b) => nodes.get(a)!.used - nodes.get(b)!.used);
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
      for (const entry of keys(ownerKey(owner).slice(0, -1))) nodes.delete(entry);
    },
    async moveOwner(from, to) {
      if (keys(ownerKey(to).slice(0, -1)).length) return;
      for (const entry of keys(ownerKey(from).slice(0, -1))) {
        const [, , kind, id] = JSON.parse(entry) as [string, string, IndexNodeKind, string];
        nodes.set(key(to, kind, id), nodes.get(entry)!);
        nodes.delete(entry);
      }
    },
    async retainProjects(projectIds) {
      for (const entry of [...nodes.keys()]) {
        if (!projectIds.has((JSON.parse(entry) as string[])[0]!)) nodes.delete(entry);
      }
    },
    marker(name) {
      return {
        exists: async () => markers.has(name),
        set: async () => void markers.add(name),
        clear: async () => void markers.delete(name),
      };
    },
  };
};

const attached = new WeakMap<DbClient, IndexNodeFiles>();

/** The host attaches its storage folder once per database; every storage service then shares it. */
export const attachIndexNodeFiles = (db: DbClient, files: IndexNodeFiles) => {
  attached.set(db, files);
};

export const indexNodeFilesFor = (db: DbClient) => {
  let files = attached.get(db);
  if (!files) {
    files = createMemoryIndexNodeFiles();
    attached.set(db, files);
  }
  return files;
};
