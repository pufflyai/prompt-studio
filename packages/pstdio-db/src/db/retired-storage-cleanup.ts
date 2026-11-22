import { and, eq, like, type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { legacyNodeRows } from "../services/extension-storage/index-node-upgrade";
import { storageOwnerKey } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { deleteStorageDocuments } from "./delete-storage-documents";
import { storage_documents as documents } from "./schemas.pg";
import { invalidateMaintenance, legacyOwnerPrefix } from "./startup-maintenance";

const BATCH_SIZE = 32;
const key = sql`(${documents.owner_id}, ${documents.document_id})`;
const address = (row: { ownerId: number; documentId: string }) => sql`(${row.ownerId}, ${row.documentId})`;

const removeRows = async (db: DbClient, filter: SQL, stopped: () => boolean, beforeDelete: () => Promise<void>) => {
  let after: SQL | undefined;
  while (!stopped()) {
    // The workbench shares this connection. Give queued work a turn between small deletes.
    await Bun.sleep(0);
    if (stopped()) return false;
    const batch = await db
      .select({
        ownerId: documents.owner_id,
        documentId: documents.document_id,
      })
      .from(documents)
      .where(and(filter, after ? sql`${key} > ${after}` : undefined))
      .orderBy(documents.owner_id, documents.document_id)
      .limit(BATCH_SIZE);
    if (!batch.length) return true;
    if (stopped()) return false;
    await beforeDelete();
    await deleteStorageDocuments(db, sql`${key} IN (${sql.join(batch.map(address), sql`, `)})`);
    after = address(batch.at(-1)!);
  }
  return false;
};

export const createRetiredStorageCleanup = (db: DbClient, path: string, owners: StorageOwner[]) => {
  let nextOwner = 0;
  let historyDone = false;
  let invalidated: Promise<void> | undefined;
  const beforeDelete = () =>
    (invalidated ??= invalidateMaintenance(path).catch((error) => {
      invalidated = undefined;
      throw error;
    }));
  return async (stopped: () => boolean) => {
    for (; nextOwner < owners.length; nextOwner++) {
      const owner = owners[nextOwner]!;
      const filter = and(eq(documents.owner_id, storageOwnerKey(owner)), like(documents.document_id, legacyNodeRows))!;
      if (!(await removeRows(db, filter, stopped, beforeDelete))) return;
    }
    if (!historyDone)
      historyDone = await removeRows(
        db,
        sql`${documents.owner_id} IN (SELECT id FROM owners WHERE starts_with(extension_id, ${legacyOwnerPrefix}))`,
        stopped,
        beforeDelete,
      );
  };
};
