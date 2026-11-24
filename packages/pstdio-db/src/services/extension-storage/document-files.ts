import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, opendir, readFile, rename, rm, rmdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { flushDirectory } from "../../db/pglite-home-recovery";

export interface DocumentFileReference {
  sha256: string;
  bytes: number;
}
export interface DocumentFileHead {
  format: 1;
  revision: number;
  foldedRevision: number;
  snapshot: DocumentFileReference;
  updates: (DocumentFileReference & { revision: number })[];
  operations?: DocumentFileReference;
  /** Released snapshots/tails used sparse counters. Kept only until the first new fold. */
  imported?: true;
  origin?: string;
}
type Kind = "state" | "update" | "head" | "copy" | "operations";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const segment = (projectId: string) => `p-${Buffer.from(projectId).toString("hex")}`;
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
const referenceValid = (value: DocumentFileReference) =>
  /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.bytes) && value.bytes >= 0;
const ancestryLevels = (directory: string) => {
  const levels: string[] = [];
  for (let level = resolve(directory); ; level = dirname(level)) {
    levels.push(level);
    if (dirname(level) === level) return levels;
  }
};
/** Batch writers have already settled and synced every object file. Flush their
 * directory entries from leaves through the root before publishing SQL references. */
export const flushDocumentDirectories = async (pending: Set<string>, durable: Set<string>) => {
  const levels = new Map<number, string[]>();
  for (const directory of pending) {
    const depth = ancestryLevels(directory).length;
    const group = levels.get(depth) ?? [];
    group.push(directory);
    levels.set(depth, group);
  }
  for (const depth of [...levels.keys()].sort((a, b) => b - a)) {
    const group = levels.get(depth)!;
    for (let offset = 0; offset < group.length; offset += 8) {
      const results = await Promise.allSettled(
        group.slice(offset, offset + 8).map(async (directory) => {
          await flushDirectory(directory);
        }),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") {
        durable.clear();
        throw failure.reason;
      }
    }
  }
  for (const directory of pending) durable.add(directory);
};
const syncParents = async (directory: string, durable?: Set<string>) => {
  const created = await mkdir(directory, { recursive: true, mode: 0o700 });
  const levels = ancestryLevels(directory);
  // Recursive mkdir may not report the created path on Windows. An untracked
  // leaf can add an entry to its already-flushed parent in either case.
  const leafParent = durable?.has(levels[0]!) ? undefined : levels[1];
  const createdParent = created === undefined ? undefined : dirname(resolve(created));
  // A previous mkdir/rename may have stopped before flushing even existing ancestors.
  for (const level of levels.reverse()) {
    if (!durable?.has(level) || level === leafParent || level === createdParent) {
      await flushDirectory(level);
      durable?.add(level);
    }
  }
};
async function* entries(path: string) {
  const directory = await opendir(path).catch((error) => {
    if (!missing(error)) throw error;
  });
  if (directory) for await (const entry of directory) yield entry;
}
const headValid = (head: DocumentFileHead) => {
  if (
    head.format !== 1 ||
    !Number.isSafeInteger(head.revision) ||
    !Number.isSafeInteger(head.foldedRevision) ||
    head.foldedRevision < 0 ||
    head.revision < head.foldedRevision ||
    !referenceValid(head.snapshot) ||
    (head.operations !== undefined && !referenceValid(head.operations)) ||
    !Array.isArray(head.updates) ||
    head.updates.length >= 128
  )
    throw new Error("Invalid document file history");
  let previous = head.foldedRevision;
  for (const update of head.updates) {
    if (
      !Number.isSafeInteger(update.revision) ||
      update.revision <= previous ||
      update.revision > head.revision ||
      !referenceValid(update)
    )
      throw new Error("Invalid document update reference");
    previous = update.revision;
  }
  if (
    !head.imported &&
    (previous !== head.revision ||
      head.updates.some((update, index) => update.revision !== head.foldedRevision + index + 1))
  )
    throw new Error("Incomplete document file history");
};
const retainFolder = async (folder: string, retained: Set<string> | null) => {
  if (retained === null) return true;
  let kept = false;
  for await (const file of entries(folder)) {
    if (file.isFile() && retained.has(file.name)) kept = true;
    else await rm(join(folder, file.name), { recursive: true, force: true });
  }
  if (!kept) await rmdir(folder);
  return kept;
};
const retainMemory = (memory: Map<string, Uint8Array>, prefix: string, retained: Map<number, Set<string> | null>) => {
  for (const address of memory.keys()) {
    const [project, id, name] = address.split(/[\\/]/);
    const known = retained.get(Number(id));
    if (project === prefix && known !== null && !known?.has(name!)) memory.delete(address);
  }
};

/** The committed head reaches a folded snapshot and at most 127 updates. Each immutable
 * object is flushed before the head, and the head before SQL. Collection keeps only objects
 * reachable from committed heads and pending file copies, while holding the transaction queue. */
export const createDocumentFiles = (root?: string) => {
  const memory = new Map<string, Uint8Array>();
  let ancestry = Promise.resolve();
  const prepareParents = (directory: string, durable?: Set<string>) => {
    // Recursive mkdir reports only its first created directory. Serialize mkdir
    // and ancestor flushes so another writer cannot cache a parent before this
    // writer adds its child; payload writes and leaf publication remain parallel.
    const result = ancestry.then(() => syncParents(directory, durable));
    ancestry = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const key = (projectId: string, id: number, kind: Kind, sha256: string) => {
    if (!Number.isSafeInteger(id) || id <= 0 || !/^[a-f0-9]{64}$/.test(sha256))
      throw new Error("Invalid document file address");
    return join(segment(projectId), String(id), `${kind}-${sha256}.${kind === "head" ? "json" : "bin"}`);
  };
  const put = async (
    projectId: string,
    id: number,
    kind: Kind,
    bytes: Uint8Array,
    durable?: Set<string>,
    pending?: Set<string>,
  ) => {
    const content = new Uint8Array(bytes);
    const reference = { sha256: hash(content), bytes: content.length };
    const address = key(projectId, id, kind, reference.sha256);
    if (!root) {
      memory.set(address, content);
      return reference;
    }
    try {
      const file = join(root, address);
      const existing = await readFile(file).catch((error) => {
        if (!missing(error)) throw error;
      });
      if (pending) {
        await mkdir(dirname(file), { recursive: true, mode: 0o700 });
        for (const directory of ancestryLevels(dirname(file))) pending.add(directory);
      } else await prepareParents(dirname(file), durable);
      if (existing && existing.length === reference.bytes && hash(existing) === reference.sha256) return reference;
      const temporary = `${file}.${randomUUID()}.tmp`;
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, file);
      if (!pending) await flushDirectory(dirname(file));
      return reference;
    } catch (error) {
      // A caught savepoint failure may leave a mkdir/rename unflushed. A retry
      // must re-establish the entire ancestry, including existing valid files.
      durable?.clear();
      throw error;
    }
  };
  const read = async (projectId: string, id: number, kind: Kind, reference: DocumentFileReference) => {
    if (!referenceValid(reference)) throw new Error("Invalid document file reference");
    const address = key(projectId, id, kind, reference.sha256);
    const bytes = root ? await readFile(join(root, address)) : memory.get(address);
    if (!bytes) throw new Error("A saved document file is missing");
    if (bytes.length !== reference.bytes || hash(bytes) !== reference.sha256)
      throw new Error("A saved document file is damaged");
    return new Uint8Array(bytes) as Uint8Array;
  };
  return {
    put,
    read,
    async head(projectId: string, id: number, reference: DocumentFileReference) {
      const bytes = await read(projectId, id, "head", reference);
      const head = JSON.parse(Buffer.from(bytes).toString()) as DocumentFileHead;
      headValid(head);
      return head;
    },
    async writeHead(
      projectId: string,
      id: number,
      head: DocumentFileHead,
      durable?: Set<string>,
      pending?: Set<string>,
    ) {
      headValid(head);
      return put(projectId, id, "head", Buffer.from(JSON.stringify(head)), durable, pending);
    },
    async *projects() {
      if (!root) {
        const names = new Set([...memory.keys()].map((address) => address.split(/[\\/]/)[0]!));
        for (const name of names) yield Buffer.from(name.slice(2), "hex").toString();
        return;
      }
      for await (const entry of entries(root)) {
        if (!entry.isDirectory() || !/^p-(?:[a-f0-9]{2})*$/.test(entry.name)) continue;
        const projectId = Buffer.from(entry.name.slice(2), "hex").toString();
        if (segment(projectId) === entry.name) yield projectId;
      }
    },
    async *documents(projectId: string) {
      const prefix = segment(projectId);
      if (!root) {
        const ids = new Set(
          [...memory.keys()].flatMap((address) => {
            const [project, id] = address.split(/[\\/]/);
            return project === prefix ? [Number(id)] : [];
          }),
        );
        yield* ids;
        return;
      }
      for await (const entry of entries(join(root, prefix)))
        if (entry.isDirectory() && /^[1-9][0-9]*$/.test(entry.name) && Number.isSafeInteger(Number(entry.name)))
          yield Number(entry.name);
    },
    async *names(projectId: string, id: number) {
      const prefix = join(segment(projectId), String(id));
      if (!root) {
        for (const address of memory.keys()) if (dirname(address) === prefix) yield address.slice(prefix.length + 1);
      } else for await (const entry of entries(join(root, prefix))) yield entry.name;
    },
    async retainDocument(projectId: string, id: number, retained: Set<string> | null) {
      if (!root) {
        const prefix = join(segment(projectId), String(id));
        for (const address of memory.keys())
          if (dirname(address) === prefix && retained !== null && !retained.has(address.slice(prefix.length + 1)))
            memory.delete(address);
        return;
      }
      const project = join(root, segment(projectId));
      const kept = await retainFolder(join(project, String(id)), retained).catch((error) => {
        if (!missing(error)) throw error;
      });
      if (kept) return;
      await rmdir(project).catch(async (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        if (missing(error) || code === "ENOTEMPTY" || code === "EEXIST") return;
        if (process.platform === "win32" && code === "EPERM") {
          // Windows can report EPERM for a directory that still has siblings.
          for await (const _entry of entries(project)) return;
        }
        throw error;
      });
    },
    async retain(projectId: string, retained: Map<number, Set<string> | null>) {
      const prefix = segment(projectId);
      if (!root) {
        retainMemory(memory, prefix, retained);
        return;
      }
      const project = join(root, prefix);
      let nonempty = false;
      for await (const document of entries(project)) {
        const folder = join(project, document.name);
        if (!document.isDirectory()) {
          await rm(folder, { force: true });
          continue;
        }
        const known = retained.get(Number(document.name));
        if (await retainFolder(folder, known === undefined ? new Set() : known)) nonempty = true;
      }
      if (!nonempty)
        await rmdir(project).catch((error) => {
          if (!missing(error)) throw error;
        });
    },
    name(kind: Kind, reference: DocumentFileReference) {
      return `${kind}-${reference.sha256}.${kind === "head" ? "json" : "bin"}`;
    },
  };
};
export {
  attachDocumentCollector,
  attachDocumentFiles,
  documentFilesFor,
  trackDocumentFiles,
  withDocumentFileTransaction,
} from "./document-file-context";
