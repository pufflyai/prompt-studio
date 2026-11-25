import { and } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import { records as canonical } from "../../db/schemas.pg";
import { canonicalRecordPredicate } from "./ordered-record-row";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { retainedHash } from "./retained-page-format";
import { createRetainedPages } from "./retained-pages";
import { type RetainedRecord, readCanonicalRecord, validateRetainedRecord } from "./retained-records";

/** A complete relay checkpoint also carries SQL-purged deleted canonical authority. */
export const checkpointCanonicalRecords = async (tx: OrderedTransaction, owner: StorageOwner) => {
  const rows = await tx
    .select()
    .from(canonical)
    .where(and(orderedOwnerWhere(canonical, owner), canonicalRecordPredicate(canonical)));
  const records = new Map<string, OrderedRecord>();
  for (const row of rows) {
    const record = await readCanonicalRecord(tx, owner, row);
    if (record) records.set(row.record_id, record);
  }
  for await (const { key, value } of createRetainedPages<RetainedRecord>(tx, owner, "tombstones").entries(
    new Set([...records.keys()].map(retainedHash)),
  ))
    if (!records.has(key)) records.set(key, (await validateRetainedRecord(key, value)).record);
  return records;
};
