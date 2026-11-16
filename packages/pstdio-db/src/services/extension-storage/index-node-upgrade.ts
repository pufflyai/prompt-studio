import { and, eq, inArray, like, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { type OrderedIndexReference, readOrderedIndexReference } from "pstdio-sync/relay";
import type { DbClient } from "../../db/connection.pglite";
import { storage_documents as documents, storage_ordered_owners as owners } from "../../db/schemas.pg";
import { type IndexNodeFiles, sortIndexChildren } from "./index-node-files";
import { orderedIndexBlobDocumentId } from "./ordered-receipts-blobs";
import { receiptRoots } from "./ordered-receipts-state";
import { decodeOrderedJson } from "./ordered-sql";

interface StoredNode {
  version: 1;
  bytes: string;
  children: OrderedIndexReference[] | null;
}

const NODE_ROWS = '["ordered-index-blob",%';
// Rows hold up to a few hundred KiB of base64; reading a few at a time bounds memory by bytes, not count.
const READ_BATCH = 16;

export interface IndexNodeUpgradeProgress {
  owner: StorageOwner;
  kept: number;
  removed: number;
}

const readRows = async (db: DbClient, owner: StorageOwner, ids: string[]) => {
  const rows = await db
    .select({ id: documents.document_id, state: documents.state })
    .from(documents)
    .where(
      and(
        eq(documents.workbench_id, owner.workbenchId),
        eq(documents.extension_id, owner.extensionId),
        inArray(documents.document_id, ids.map(orderedIndexBlobDocumentId)),
      ),
    );
  return rows.map((row) => ({
    id: (JSON.parse(row.id) as [string, string])[1],
    node: decodeOrderedJson<StoredNode | null>(row.state),
  }));
};

/**
 * Writes one page of stored nodes as receipt files and returns the ids of their children. A node
 * already moved, or written by sync after an earlier partial run, has no row; its file's edges
 * continue the walk so descendants that only have rows are still copied.
 */
const copyRows = async (db: DbClient, files: IndexNodeFiles, owner: StorageOwner, ids: string[]) => {
  const children: string[] = [];
  const rows = await readRows(db, owner, ids);
  for (const { id, node } of rows) {
    if (node?.version !== 1 || typeof node.bytes !== "string") throw new Error(`Invalid stored index node ${id}`);
    const edges = node.children && sortIndexChildren(node.children.map(readOrderedIndexReference));
    await files.write(owner, "receipts", id, { bytes: Buffer.from(node.bytes, "base64"), children: edges });
    for (const child of edges ?? []) children.push(child.blobId);
  }
  const copied = new Set(rows.map((row) => row.id));
  for (const id of ids.filter((candidate) => !copied.has(candidate)))
    for (const child of (await files.edges(owner, "receipts", id)) ?? []) children.push(child.blobId);
  return children;
};

/**
 * Moves one owner's receipt nodes that its saved roots reach into files, then drops every
 * index-node row of that owner. Unreachable rows are garbage receipt nodes or log and history
 * nodes, which are a cache of relay data. Files are written before rows are deleted, so an
 * interrupted run repeats the owner safely.
 */
const upgradeOwner = async (db: DbClient, files: IndexNodeFiles, owner: StorageOwner) => {
  const [row] = await db
    .select({ receipt_root: owners.receipt_root })
    .from(owners)
    .where(and(eq(owners.workbench_id, owner.workbenchId), eq(owners.extension_id, owner.extensionId)));
  const roots = row ? receiptRoots(row.receipt_root) : { root: null, published: null };
  const seen = new Set<string>();
  let pending = [roots.root, roots.published].filter((root) => !!root).map((root) => root!.blobId);
  while (pending.length) {
    const ids = [...new Set(pending.filter((id) => !seen.has(id)))];
    pending = [];
    for (let offset = 0; offset < ids.length; offset += READ_BATCH) {
      const page = ids.slice(offset, offset + READ_BATCH);
      for (const id of page) seen.add(id);
      pending.push(...(await copyRows(db, files, owner, page)));
    }
  }
  const kept = (await files.list(owner, "receipts")).length;
  const removed = await db
    .delete(documents)
    .where(
      and(
        eq(documents.workbench_id, owner.workbenchId),
        eq(documents.extension_id, owner.extensionId),
        like(documents.document_id, NODE_ROWS),
      ),
    )
    .returning({ id: documents.document_id });
  return { owner, kept, removed: removed.length };
};

/**
 * One-time move of index nodes from database rows to files (rule 0006.2.16). Returns whether rows
 * were removed, so startup compacts the database. An owner with unreadable rows keeps them and
 * is retried on the next start; it never stops the app from opening.
 */
export const upgradeIndexNodesToFiles = async (
  db: DbClient,
  files: IndexNodeFiles,
  report: (progress: IndexNodeUpgradeProgress) => void = () => {},
  /** Runs once before the first row is deleted, so space reclamation is recorded as owed first. */
  beforeChange: () => Promise<void> = async () => {},
) => {
  const result = await db.execute(
    sql`SELECT DISTINCT workbench_id, extension_id FROM ${documents} WHERE document_id LIKE ${NODE_ROWS}
      ORDER BY workbench_id, extension_id`,
  );
  let removed = false;
  if (result.rows.length) await beforeChange();
  for (const row of result.rows) {
    const owner = { workbenchId: String(row.workbench_id), extensionId: String(row.extension_id) };
    try {
      const progress = await upgradeOwner(db, files, owner);
      removed ||= progress.removed > 0;
      report(progress);
    } catch (error) {
      console.warn("Index nodes of one storage owner stay in the database until the next start.", owner, error);
    }
  }
  return removed;
};
