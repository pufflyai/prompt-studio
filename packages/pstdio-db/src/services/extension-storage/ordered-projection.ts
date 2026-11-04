import { and, gt, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedRecord, readOrderedObservation } from "pstdio-sync/records";
import { assertStorageLimits } from "pstdio-sync-contracts";
import { storage_current_records as current, storage_record_projections as projections } from "../../db/schemas.pg";
import type { OrderedJournal } from "./ordered-journal";
import { convertLegacyOrderedRecord } from "./ordered-legacy-record";
import { projectOrderedNativeAssets } from "./ordered-native-assets";
import { refreshOrderedNativeVersions } from "./ordered-native-versions";
import { indexInitialCanonicalNumbers } from "./ordered-number-canonical";
import { retainNumberHistory } from "./ordered-number-values";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { writeProjectedRecords } from "./record-projection-rows";
import { readProjectedRecords } from "./record-queries";

export { orderedBody, orderedProjection } from "pstdio-sync/records";

import { orderedProjection } from "pstdio-sync/records";

/** Decode the optimistic projection, including unresolved authored stamps in its portable revision. */
export const orderedViews = async (tx: Pick<OrderedTransaction, "select">, owner: StorageOwner, ids: string[]) => {
  const found = new Map<string, OrderedRecord>();
  for (const record of await readProjectedRecords(tx, owner, ids)) {
    if (!record.exists) continue;
    const observation = readOrderedObservation(record.revision);
    found.set(record.recordId, {
      recordId: record.recordId,
      value: { value: record.value, asset: record.asset, shared: record.shared },
      deleted: record.deleted,
      lifetime: observation.lifetime!,
      stamps: observation.stamps,
    });
  }
  return found;
};

/** One-time local conversion; keep legacy source bytes until new-format adoption is durable. */
export const initializeOrderedOwner = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  created: boolean,
) => {
  if (!created) return;
  let after: string | undefined;
  while (true) {
    const rows = await tx
      .select({ id: current.record_id })
      .from(current)
      .where(and(orderedOwnerWhere(current, owner), after === undefined ? undefined : gt(current.record_id, after)))
      .orderBy(current.record_id)
      .limit(100);
    if (!rows.length) break;
    const records = await readProjectedRecords(
      tx,
      owner,
      rows.map((row) => row.id),
    );
    const converted: OrderedRecord[] = [];
    for (const record of records) {
      const value = await convertLegacyOrderedRecord(tx, owner, record);
      converted.push(owner.extensionId === coreOwnerId ? retainNumberHistory(undefined, value) : value);
    }
    await journal.saveCanonical(converted);
    await indexInitialCanonicalNumbers(tx, owner, converted);
    await publishOrderedProjection(tx, owner, converted);
    after = rows.at(-1)!.id;
  }
};

export const publishOrderedProjection = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
) => {
  if (!records.length) return { records: [], projected: 0 };
  const previous = await readProjectedRecords(
    tx,
    owner,
    records.map((record) => record.recordId),
  );
  const materialized = await Promise.all(
    records.map(async (record) => projectOrderedNativeAssets(tx, owner, await orderedProjection(record))),
  );
  // A latest state contains independent saves, not one enormous author group.
  for (const record of materialized) assertStorageLimits([record]);
  const delta = materialized.reduce(
    (sum, record, index) =>
      sum + Number(!record.deleted) - Number(previous[index]!.exists && !previous[index]!.deleted),
    0,
  );
  const projected = await writeProjectedRecords(tx, owner, materialized);
  await refreshOrderedNativeVersions(tx, owner, records, previous);
  if (projected)
    await tx
      .update(projections)
      .set({ revision: sql`${projections.revision} + 1`, live_count: sql`${projections.live_count} + ${delta}` })
      .where(orderedOwnerWhere(projections, owner));
  return { records: materialized, projected };
};

/** A refused optimistic creation becomes absent, rather than a retained tombstone. */
export const removeOrderedProjection = async (tx: OrderedTransaction, owner: StorageOwner, ids: string[]) => {
  let removed = 0;
  let live = 0;
  for (let offset = 0; offset < ids.length; offset += 1_000) {
    const rows = await tx
      .delete(current)
      .where(and(orderedOwnerWhere(current, owner), inArray(current.record_id, ids.slice(offset, offset + 1_000))))
      .returning({ deleted: current.deleted });
    removed += rows.length;
    live += rows.filter((row) => !row.deleted).length;
  }
  if (removed)
    await tx
      .update(projections)
      .set({ revision: sql`${projections.revision} + 1`, live_count: sql`${projections.live_count} - ${live}` })
      .where(orderedOwnerWhere(projections, owner));
  return removed;
};
