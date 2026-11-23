import { and, inArray, type SQLWrapper, sql } from "drizzle-orm";
import { alias, type PgInsertValue } from "drizzle-orm/pg-core";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import type { Json } from "pstdio-sync-contracts";
import { records } from "../../db/schemas.pg";
import { noteCanonicalRecordWrite, type OrderedPublicationBaseline } from "./ordered-record-publication";
import { confirmedRecordBase, stableRecordColumns } from "./ordered-record-row";
import { type OrderedTransaction, orderedAddress, orderedOwnerWhere as ownerWhere } from "./ordered-sql";
import { hasRetainedRecords, readCanonicalRecord, readRetainedRecord } from "./retained-records";

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

const hydrateRetainedCanonical = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  ids: string[],
  found: Map<string, OrderedRecord>,
) => {
  if (!ids.length || !(await hasRetainedRecords(tx, owner))) return;
  for (const id of ids) {
    const saved = await readRetainedRecord(tx, owner, id);
    if (saved) found.set(id, saved.record);
  }
};

const readCanonicalPage = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  page: string[],
  previous?: OrderedPublicationBaseline,
) => {
  const where = and(ownerWhere(confirmed, owner), inArray(confirmed.record_id, page));
  if (!previous) return tx.select(canonicalColumns).from(confirmed).where(where);
  const rows = await tx
    .select({
      ...canonicalColumns,
      revision: confirmed.revision,
      visibleSources: confirmed.native_sources,
      retained: sql<boolean>`coalesce(${confirmed.meta}->>'retained'='1', false)`,
    })
    .from(confirmed)
    .where(where);
  for (const id of page) previous.set(id, null);
  for (const row of rows)
    if (row.revision !== null)
      previous.set(row.record_id, {
        recordId: row.record_id,
        deleted: row.deleted,
        revision: row.revision,
        lifetime: row.record_lifetime,
        nativeSources: row.visibleSources,
        retained: row.retained,
      });
  return rows;
};

type CanonicalRecords = {
  canonical(ids: string[], previous?: OrderedPublicationBaseline): Promise<Map<string, OrderedRecord>>;
  saveCanonical(records: OrderedRecord[]): Promise<void>;
  forgetCanonicalReads?(): void;
};

export const createOrderedCanonical = (tx: OrderedTransaction, owner: StorageOwner): CanonicalRecords => ({
  async canonical(ids, previous) {
    const found = new Map<string, OrderedRecord>();
    for (let offset = 0; offset < ids.length; offset += 100) {
      const page = ids.slice(offset, offset + 100);
      const rows = await readCanonicalPage(tx, owner, page, previous);
      for (const row of rows) {
        const record = await readCanonicalRecord(tx, owner, row);
        if (record) found.set(row.record_id, record);
      }
      const present = new Set(rows.map((row) => row.record_id));
      const missing = page.filter((id) => !present.has(id));
      await hydrateRetainedCanonical(tx, owner, missing, found);
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
