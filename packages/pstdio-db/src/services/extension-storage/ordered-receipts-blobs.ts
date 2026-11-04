import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { openBlob, type SyncSpace } from "pstdio-sync/encryption";
import { type OrderedIndexBlobs, type OrderedIndexReference, readOrderedIndexReference } from "pstdio-sync/relay";
import type { DbClient } from "../../db/connection.pglite";
import { storage_documents as documents } from "../../db/schemas.pg";
import { decodeOrderedJson, encodeOrderedJson, type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";

export const orderedIndexBlobDocumentId = (id: string) => JSON.stringify(["ordered-index-blob", id]);
interface CachedNode {
  version: 1;
  bytes: string;
  children: OrderedIndexReference[] | null;
}

/** Durable ciphertext is private cache data, excluded from document discovery and Yjs transports. */
export const createOrderedManifestCache = (
  db: DbClient,
  owner: StorageOwner,
  space: SyncSpace,
  remote: OrderedIndexBlobs,
) => {
  const context = new AsyncLocalStorage<OrderedTransaction>();
  const connection = () => context.getStore() ?? db;
  const where = (id: string) =>
    and(orderedOwnerWhere(documents, owner), eq(documents.document_id, orderedIndexBlobDocumentId(id)));
  const saved = async (id: string) => {
    const [row] = await connection().select({ state: documents.state }).from(documents).where(where(id));
    if (!row) return undefined;
    const node = decodeOrderedJson<CachedNode>(row.state);
    if (
      !node ||
      node.version !== 1 ||
      typeof node.bytes !== "string" ||
      (node.children !== null && !Array.isArray(node.children))
    )
      throw new Error("Invalid cached manifest node");
    return {
      bytes: Uint8Array.from(Buffer.from(node.bytes, "base64")),
      children: node.children?.map(readOrderedIndexReference) ?? null,
    };
  };
  const persist = async (id: string, node: { bytes: Uint8Array; children: OrderedIndexReference[] | null }) => {
    const state = encodeOrderedJson({
      version: 1,
      bytes: Buffer.from(node.bytes).toString("base64"),
      children: node.children,
    } satisfies CachedNode);
    await connection()
      .insert(documents)
      .values({
        workbench_id: owner.workbenchId,
        extension_id: owner.extensionId,
        document_id: orderedIndexBlobDocumentId(id),
        state,
      })
      .onConflictDoUpdate({
        target: [documents.workbench_id, documents.extension_id, documents.document_id],
        set: { state },
      });
  };
  const storeBytes = async (id: string, bytes: Uint8Array) => {
    const previous = await saved(id);
    if (previous && !Buffer.from(previous.bytes).equals(bytes)) throw new Error("Cached encrypted node is immutable");
    if (!previous) await persist(id, { bytes: bytes.slice(), children: null });
  };
  const blobs: OrderedIndexBlobs = {
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
      const ordered = [...children].sort((a, b) => a.blobId.localeCompare(b.blobId));
      if (cached.children && JSON.stringify(cached.children) !== JSON.stringify(ordered))
        throw new Error("Cached manifest edges are immutable");
      if (!cached.children) await persist(reference.blobId, { bytes: cached.bytes, children: ordered });
    },
  };
  return {
    blobs,
    transaction: <T>(tx: OrderedTransaction, run: () => Promise<T>) => context.run(tx, run),
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
      for (const { reference, node } of ordered)
        await remote.put(
          reference.blobId,
          node.bytes,
          node.children!.map((child) => child.blobId),
        );
    },
  };
};
