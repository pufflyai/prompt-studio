import { and, inArray, type SQLWrapper, sql } from "drizzle-orm";
import { alias, type PgInsertValue } from "drizzle-orm/pg-core";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import type { Json } from "pstdio-sync-contracts";
import { records } from "../../db/schemas.pg";
import { noteCanonicalRecordWrite } from "./ordered-record-publication";
import { confirmedRecordBase, stableRecordColumns } from "./ordered-record-row";
import { type OrderedTransaction, orderedAddress, orderedOwnerWhere as ownerWhere } from "./ordered-sql";
import { readCanonicalRecord } from "./retained-records";

const confirmed = alias(records, "confirmed_record");
const bodyUnlessPending = (column: SQLWrapper) =>
  sql<Json>`CASE WHEN ${confirmed.base} IS NULL THEN ${column} ELSE NULL END`;
const canonicalColumns = {
  record_id: confirmed.record_id,
  deleted: confirmed.deleted,
  record_lifetime: confirmed.record_lifetime,
  value: bodyUnlessPending(confirmed.value),
  asset: bodyUnlessPending(confirmed.asset),
  shared: bodyUnlessPending(confirmed.shared),
  native_sources: bodyUnlessPending(confirmed.native_sources),
  meta: bodyUnlessPending(confirmed.meta),
  base: confirmed.base,
};

export const createOrderedCanonical = (tx: OrderedTransaction, owner: StorageOwner) => ({
  async canonical(ids: string[]) {
    const found = new Map<string, OrderedRecord>();
    for (let offset = 0; offset < ids.length; offset += 100) {
      const rows = await tx
        .select(canonicalColumns)
        .from(confirmed)
        .where(and(ownerWhere(confirmed, owner), inArray(confirmed.record_id, ids.slice(offset, offset + 100))));
      for (const row of rows) {
        const record = await readCanonicalRecord(tx, owner, row);
        if (record) found.set(row.record_id, record);
      }
    }
    return found;
  },
  async saveCanonical(input: OrderedRecord[]) {
    // Until publication, the existing query columns retain the previous visible state.
    // A new canonical-only occurrence deliberately has no query revision.
    let batch: PgInsertValue<typeof records>[] = [],
      bytes = 0;
    const flush = async () => {
      if (!batch.length) return;
      await tx
        .insert(records)
        .values(batch)
        .onConflictDoUpdate({ target: [records.owner_id, records.record_id], set: { base: sql`excluded.base` } });
      batch = [];
      bytes = 0;
    };
    for (const record of input) {
      const base = confirmedRecordBase(record);
      if (batch.length && (bytes + base.length > 4 * 1024 * 1024 || batch.length === 1000)) await flush();
      batch.push({
        ...orderedAddress(owner),
        record_id: record.recordId,
        ...stableRecordColumns(record),
        revision: null,
        base,
      });
      bytes += base.length;
    }
    await flush();
    noteCanonicalRecordWrite(
      tx,
      owner,
      input.map((record) => record.recordId),
    );
  },
});
