import { and, eq, like, type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { legacyNodeRows } from "../services/extension-storage/index-node-upgrade";
import type { DbClient } from "./connection.pglite";
import { storage_documents as documents } from "./schemas.pg";
import { invalidateMaintenance, legacyOwnerPrefix } from "./startup-maintenance";

const BATCH_SIZE = 32;
const key = sql`(${documents.workbench_id}, ${documents.extension_id}, ${documents.document_id})`;
const address = (row: { workbenchId: string; extensionId: string; documentId: string }) =>
  sql`(${row.workbenchId}, ${row.extensionId}, ${row.documentId})`;

const removeRows = async (db: DbClient, filter: SQL, stopped: () => boolean, beforeDelete: () => Promise<void>) => {
  let after: SQL | undefined;
  while (!stopped()) {
    // The workbench shares this connection. Give queued work a turn between small deletes.
    await Bun.sleep(0);
    if (stopped()) return false;
    const batch = await db
      .select({
        workbenchId: documents.workbench_id,
        extensionId: documents.extension_id,
        documentId: documents.document_id,
      })
      .from(documents)
      .where(and(filter, after ? sql`${key} > ${after}` : undefined))
      .orderBy(documents.workbench_id, documents.extension_id, documents.document_id)
      .limit(BATCH_SIZE);
    if (!batch.length) return true;
    if (stopped()) return false;
    await beforeDelete();
    await db.delete(documents).where(sql`${key} IN (${sql.join(batch.map(address), sql`, `)})`);
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
      const filter = and(
        eq(documents.workbench_id, owner.workbenchId),
        eq(documents.extension_id, owner.extensionId),
        like(documents.document_id, legacyNodeRows),
      )!;
      if (!(await removeRows(db, filter, stopped, beforeDelete))) return;
    }
    if (!historyDone)
      historyDone = await removeRows(
        db,
        sql`starts_with(${documents.extension_id}, ${legacyOwnerPrefix})`,
        stopped,
        beforeDelete,
      );
  };
};
