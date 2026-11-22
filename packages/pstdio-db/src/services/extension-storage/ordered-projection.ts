import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import { assertStorageLimits } from "pstdio-sync-contracts";
import { storage_current_records as current, owners as projections } from "../../db/schemas.pg";
import { projectOrderedNativeAssets } from "./ordered-native-assets";
import { refreshOrderedNativeVersions } from "./ordered-native-versions";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { writeProjectedRecords } from "./record-projection-rows";
import { refreshResourceQueryValues } from "./resource-query-values";

export { orderedBody, orderedProjection } from "pstdio-sync/records";

import { orderedProjection } from "pstdio-sync/records";

export const publishOrderedProjection = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
) => {
  if (!records.length) return { records: [], projected: 0 };
  const previous = await tx
    .select({ recordId: current.record_id, deleted: current.deleted, nativeSources: current.native_sources })
    .from(current)
    .where(
      and(
        orderedOwnerWhere(current, owner),
        inArray(
          current.record_id,
          records.map(({ recordId }) => recordId),
        ),
      ),
    );
  const before = new Map(previous.map((record) => [record.recordId, record]));
  const materialized = await Promise.all(
    records.map(async (record) => projectOrderedNativeAssets(tx, owner, await orderedProjection(record))),
  );
  // A latest state contains independent saves, not one enormous author group.
  for (const record of materialized) assertStorageLimits([record]);
  const delta = materialized.reduce(
    (sum, record) =>
      sum + Number(!record.deleted) - Number(before.has(record.recordId) && !before.get(record.recordId)!.deleted),
    0,
  );
  const projected = await writeProjectedRecords(tx, owner, materialized);
  await refreshResourceQueryValues(
    tx,
    owner,
    records.map(({ recordId }) => recordId),
  );
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
