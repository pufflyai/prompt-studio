import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { type OrderedRecord, verifyOrderedRecord } from "pstdio-sync/records";
import { documents } from "../../db/schemas/documents";
import { trackDocumentFiles } from "./document-files";
import { type CanonicalRecordRow, canonicalRecordFromRow, isCompactedCanonicalMeta } from "./ordered-record-row";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { decodeProjectionValue, encodeProjectionValue } from "./record-projection-codec";
import { createRetainedPages } from "./retained-pages";

export interface RetainedRecord {
  record: OrderedRecord;
  revision: string;
  compactedAt: string;
}

export const compactedRecordMetadata = (record: OrderedRecord) =>
  encodeProjectionValue({ retained: 1, stamps: Object.entries(record.stamps) });

/** A compact SQL tombstone retains its exact canonical observation in private files.
 * Missing or mismatched authority must never be interpreted as a record that never existed. */
export const readCanonicalRecord = async (tx: OrderedTransaction, owner: StorageOwner, row: CanonicalRecordRow) => {
  if (row.base !== null || !isCompactedCanonicalMeta(row.meta)) return canonicalRecordFromRow(row);
  const saved = await createRetainedPages<RetainedRecord>(tx, owner, "tombstones").get(row.record_id);
  if (!saved) throw new Error("The compacted record's retained value is missing");
  const record = await verifyOrderedRecord(saved.record);
  const metadata = decodeProjectionValue(row.meta) as { stamps: [string, string][] };
  if (
    !row.deleted ||
    !record.deleted ||
    record.recordId !== row.record_id ||
    record.lifetime !== row.record_lifetime ||
    JSON.stringify(Object.entries(record.stamps)) !== JSON.stringify(metadata.stamps)
  )
    throw new Error("The compacted record does not match its retained value");
  return record;
};

export const readCanonicalRecords = async (tx: OrderedTransaction, owner: StorageOwner, rows: CanonicalRecordRow[]) => {
  const records: OrderedRecord[] = [];
  for (const row of rows) {
    const record = await readCanonicalRecord(tx, owner, row);
    if (record) records.push(record);
  }
  return records;
};

/** Obsolete deleted values leave the private index when ordinary publication replaces them. */
export const removeRetainedRecords = async (tx: OrderedTransaction, owner: StorageOwner, ids: string[]) => {
  const pages = createRetainedPages<RetainedRecord>(tx, owner, "tombstones");
  for (let offset = 0; offset < ids.length; offset += 100)
    await pages.set(ids.slice(offset, offset + 100).map((key) => ({ key, value: undefined })));
};

/** Checkpoint replacement retires the old canonical generation, including its private bodies. */
export const clearRetainedRecords = async (tx: OrderedTransaction, owner: StorageOwner) => {
  while (true) {
    const rows = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          orderedOwnerWhere(documents, owner),
          sql`starts_with(${documents.key}, '["ordered-retention","tombstones",')`,
        ),
      )
      .orderBy(documents.id)
      .limit(100);
    if (!rows.length) return;
    await tx.delete(documents).where(
      inArray(
        documents.id,
        rows.map((row) => row.id),
      ),
    );
    for (const row of rows) trackDocumentFiles(tx, owner.workbenchId, row.id);
  }
};
