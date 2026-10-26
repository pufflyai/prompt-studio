import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { StorageRecord } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records, storage_documents, storage_record_projections } from "../../db/schemas.pg";
import { publishProjectedRecords } from "./record-projection-rows";
import { persistResourceDocuments } from "./resource-document-persistence";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const ownerWhere = (owner: StorageOwner) =>
  and(
    eq(storage_record_projections.workbench_id, owner.workbenchId),
    eq(storage_record_projections.extension_id, owner.extensionId),
  );

/** Locks the owner's projection row, which serializes its record writes, and returns its revision. */
export const lockRecordOwner = async (tx: Transaction, owner: StorageOwner) => {
  await tx
    .insert(storage_documents)
    .values({
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      document_id: "records",
      state: new Uint8Array([0, 0]),
    })
    .onConflictDoNothing();
  await tx
    .insert(storage_record_projections)
    .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId, revision: 0 })
    .onConflictDoNothing();
  const [row] = await tx
    .select({ revision: storage_record_projections.revision })
    .from(storage_record_projections)
    .where(ownerWhere(owner))
    .for("update");
  return row!.revision;
};

export interface RecordChange {
  id: string;
  revision: number;
  foldedRevision: number;
  checkpoint: Uint8Array | null;
  update: Uint8Array | null;
  record: StorageRecord;
}

/**
 * Writes changed record documents with their query rows and advances the owner revision, inside the
 * caller's transaction after `lockRecordOwner`. Returns how many query rows changed.
 */
export const saveRecordChanges = async (
  tx: Transaction,
  owner: StorageOwner,
  revision: number,
  changes: RecordChange[],
) => {
  const ids = changes.map((change) => change.record.recordId);
  // Only the previous live state matters for the count; values stay unread.
  const before = new Map<string, boolean>();
  for (let offset = 0; offset < ids.length; offset += 1_000) {
    const rows = await tx
      .select({ id: storage_current_records.record_id, deleted: storage_current_records.deleted })
      .from(storage_current_records)
      .where(
        and(
          eq(storage_current_records.workbench_id, owner.workbenchId),
          eq(storage_current_records.extension_id, owner.extensionId),
          inArray(storage_current_records.record_id, ids.slice(offset, offset + 1_000)),
        ),
      );
    for (const row of rows) before.set(row.id, !row.deleted);
  }
  await persistResourceDocuments(tx, owner, changes);
  const records = changes.map((change) => change.record);
  const projected = await publishProjectedRecords(tx, owner, records);
  const live = (record: { exists: boolean; deleted: boolean }) => Number(record.exists && !record.deleted);
  const delta = records.reduce((sum, record) => sum + live(record) - Number(before.get(record.recordId) ?? false), 0);
  await tx
    .update(storage_record_projections)
    .set({ revision: revision + 1, live_count: sql`${storage_record_projections.live_count} + ${delta}` })
    .where(ownerWhere(owner));
  return projected;
};
