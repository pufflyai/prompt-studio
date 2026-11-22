import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { owners as recordOwners, storage_current_records } from "../../db/schemas.pg";
import { ensureFileDocument } from "./document-file-persistence";
import { documentFilesFor } from "./document-files";
import { lockStorageProject, type NativeProjectedRecord } from "./native-record-projection";
import { publishProjectedRecords } from "./record-projection-rows";
import { persistResourceDocuments } from "./resource-document-persistence";
import { projectNumberRecords } from "./resource-number-records";
import { previousNumbers, repairNumberRecords } from "./resource-number-repair";
import { storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const ownerWhere = (owner: StorageOwner) => and(eq(recordOwners.id, storageOwnerKey(owner)));

/** Locks the owner's projection row, which serializes its record writes, and returns its revision. */
export const lockRecordOwner = async (tx: Transaction, owner: StorageOwner) => {
  await lockStorageProject(tx, owner.workbenchId);
  await ensureFileDocument(tx, documentFilesFor(tx), { owner, key: "records", kind: "local" });
  const [row] = await tx
    .select({ revision: recordOwners.revision })
    .from(recordOwners)
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
  record: NativeProjectedRecord;
}

/**
 * Writes changed record documents with their query rows and advances the owner revision, inside the
 * caller's transaction after `lockRecordOwner`, including core number repairs. The caller owns
 * outbox framing and notifications after commit.
 */
export const saveRecordChanges = async (
  tx: Transaction,
  owner: StorageOwner,
  revision: number,
  changes: RecordChange[],
) => {
  const ids = changes.map((change) => change.record.recordId);
  const previous = await previousNumbers(tx, owner, ids);
  // Only the previous live state matters for the count; values stay unread.
  const before = new Map<string, boolean>();
  for (let offset = 0; offset < ids.length; offset += 1_000) {
    const rows = await tx
      .select({ id: storage_current_records.record_id, deleted: storage_current_records.deleted })
      .from(storage_current_records)
      .where(
        and(
          eq(storage_current_records.owner_id, storageOwnerKey(owner)),
          inArray(storage_current_records.record_id, ids.slice(offset, offset + 1_000)),
        ),
      );
    for (const row of rows) before.set(row.id, !row.deleted);
  }
  await persistResourceDocuments(tx, owner, changes);
  const records = changes.map((change) => change.record);
  const projected = await publishProjectedRecords(tx, owner, records);
  await projectNumberRecords(tx, owner, records, revision + 1);
  const repaired = await repairNumberRecords(tx, owner, records, revision + 1, previous);
  await persistResourceDocuments(tx, owner, repaired.changes);
  const repairedCount = await publishProjectedRecords(
    tx,
    owner,
    repaired.changes.map((change) => change.record),
  );
  const live = (record: { exists: boolean; deleted: boolean }) => Number(record.exists && !record.deleted);
  const delta = records.reduce((sum, record) => sum + live(record) - Number(before.get(record.recordId) ?? false), 0);
  await tx
    .update(recordOwners)
    .set({ revision: revision + 1, live_count: sql`${recordOwners.live_count} + ${delta}` })
    .where(ownerWhere(owner));
  return {
    projected: projected + repairedCount,
    events: repaired.events,
    records: repaired.records,
    repairs: repaired.changes,
  };
};
