import type { StorageOwner } from "pstdio-sync";
import { openBlob, type SyncSpace } from "pstdio-sync/encryption";
import { type OrderedIndexBlobs, type OrderedIndexReference, readOrderedIndexReference } from "pstdio-sync/relay";
import { type IndexNodeFiles, type IndexNodeKind, sortIndexChildren } from "./index-node-files";

/** Rows the database kept before index nodes moved to files; only the upgrade reads them. */
export const orderedIndexBlobDocumentId = (id: string) => JSON.stringify(["ordered-index-blob", id]);

/**
 * Encrypted index nodes for one owner, kept in files (rule 0006.2.15). Nodes are immutable:
 * a node's bytes and, once validated, its edges never change.
 */
export const createOrderedManifestCache = (
  files: IndexNodeFiles,
  owner: StorageOwner,
  kind: IndexNodeKind,
  space: SyncSpace,
  remote: OrderedIndexBlobs,
) => {
  const saved = (id: string) => files.read(owner, kind, id);
  const storeBytes = async (id: string, bytes: Uint8Array) => {
    const previous = await saved(id);
    if (previous && !Buffer.from(previous.bytes).equals(bytes)) throw new Error("Cached encrypted node is immutable");
    if (!previous) await files.write(owner, kind, id, { bytes: bytes.slice(), children: null });
  };
  const blobs: OrderedIndexBlobs = {
    // Files need no write batching; callers keep their batch boundaries.
    batch: (run) => run(),
    async get(id, extent) {
      const cached = await saved(id);
      const bytes = cached?.bytes ?? (await remote.get(id, extent));
      if (bytes.length !== extent) throw new Error("Cached manifest differs from authenticated extent");
      if (!cached) await storeBytes(id, bytes);
      return bytes.slice();
    },
    async put(id, bytes, children) {
      await storeBytes(id, bytes);
      await remote.put(id, bytes, [...children].sort());
    },
    async remember(reference, children) {
      const cached = await saved(reference.blobId);
      if (!cached || cached.bytes.length !== reference.byteLength)
        throw new Error("Cannot retain an unavailable manifest node");
      const ordered = sortIndexChildren(children);
      if (cached.children && JSON.stringify(sortIndexChildren(cached.children)) !== JSON.stringify(ordered))
        throw new Error("Cached manifest edges are immutable");
      if (!cached.children)
        await files.write(owner, kind, reference.blobId, { bytes: cached.bytes, children: ordered });
    },
  };
  return {
    blobs,
    async replay(input: OrderedIndexReference) {
      const root = readOrderedIndexReference(input);
      const tasks: { reference: OrderedIndexReference; finish: boolean }[] = [{ reference: root, finish: false }];
      const seen = new Set<string>();
      const ordered: { reference: OrderedIndexReference; node: NonNullable<Awaited<ReturnType<typeof saved>>> }[] = [];
      while (tasks.length) {
        const task = tasks.pop()!;
        const node = await saved(task.reference.blobId);
        if (!node || node.children === null || node.bytes.length !== task.reference.byteLength)
          throw new Error("Local receipt graph is incomplete; missing pages cannot establish absence");
        if (task.finish) {
          ordered.push({ reference: task.reference, node });
          continue;
        }
        if (seen.has(task.reference.blobId)) continue;
        seen.add(task.reference.blobId);
        await openBlob(space, task.reference.blobId, node.bytes);
        tasks.push({ ...task, finish: true });
        for (const child of node.children) tasks.push({ reference: child, finish: false });
      }
      // Prove the full local graph before publishing any restored root or child references.
      // Children go up in the order `put` first sent them; the relay rejects any other order.
      for (const { reference, node } of ordered)
        await remote.put(reference.blobId, node.bytes, node.children!.map((child) => child.blobId).sort());
    },
  };
};

/**
 * Removes receipt nodes that no saved root reaches through known edges.
 *
 * Missing nodes and nodes whose edges are not yet validated are traversal leaves. Anything only
 * reachable through them was fetched from the relay, which still holds it while a root needs it,
 * so removing the local copy costs a download at most. Nodes this device wrote always record
 * their edges before a root naming them is saved, so the device's only copies are never removed.
 * Run it under the owner lock with no staged checkpoint, so no unsaved root is in flight.
 */
export const collectOrderedReceiptNodes = async (
  files: IndexNodeFiles,
  owner: StorageOwner,
  roots: (OrderedIndexReference | null | undefined)[],
) => {
  const reachable = new Set<string>();
  const pending = roots.filter((root): root is OrderedIndexReference => !!root).map((root) => root.blobId);
  while (pending.length) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = await files.read(owner, "receipts", id);
    for (const child of node?.children ?? []) pending.push(child.blobId);
  }
  const unreachable = (await files.list(owner, "receipts")).filter((id) => !reachable.has(id));
  await files.remove(owner, "receipts", unreachable);
  return { kept: reachable.size, removed: unreachable.length };
};
