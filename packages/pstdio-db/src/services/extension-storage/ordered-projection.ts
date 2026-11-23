import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import { assertStorageLimits } from "pstdio-sync-contracts";
import { records as current, owners as projections } from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";
import { projectOrderedNativeAssets } from "./ordered-native-assets";
import { refreshOrderedNativeVersions } from "./ordered-native-versions";
import { noteRecordPublication, orderedProjectionFacets } from "./ordered-record-publication";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { decodeProjectionValue } from "./record-projection-codec";
import { writeProjectedRecords } from "./record-projection-rows";
import { refreshResourceQueryValues } from "./resource-query-values";
import { createRetainedPages } from "./retained-pages";
import { removeRetainedRecords } from "./retained-records";

export { orderedBody, orderedProjection } from "pstdio-sync/records";

import { orderedProjection } from "pstdio-sync/records";

export const publishOrderedProjection = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  records: OrderedRecord[],
) => {
  if (!records.length) return { records: [], projected: 0 };
  const facets = await orderedProjectionFacets(tx, owner, records);
  const previous = await tx
    .select({
      recordId: current.record_id,
      deleted: current.deleted,
      nativeSources: current.native_sources,
      retained: sql<boolean>`${current.meta}->>'retained'='1'`,
    })
    .from(current)
    .where(
      and(
        orderedOwnerWhere(current, owner),
        sql`${current.revision} IS NOT NULL`,
        inArray(
          current.record_id,
          records.map(({ recordId }) => recordId),
        ),
      ),
    );
  for (const row of previous)
    row.nativeSources = row.deleted
      ? {}
      : (decodeProjectionValue(row.nativeSources as never) as unknown as typeof row.nativeSources);
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
  for (const batch of jsonBatches(
    records.map((record) => {
      const facet = facets.get(record.recordId)!;
      return {
        record_id: record.recordId,
        meta: facet.meta,
        base: facet.base === null ? null : Buffer.from(facet.base).toString("hex"),
        deleted: record.deleted,
        value: facet.value,
        asset: facet.asset,
        shared: facet.shared,
        native_sources: facet.native_sources,
      };
    }),
  ))
    await tx.execute(sql`UPDATE records target SET meta=input.meta,base=decode(input.base,'hex'),
    value=CASE WHEN input.deleted THEN input.value ELSE target.value END,
    asset=CASE WHEN input.deleted THEN input.asset ELSE target.asset END,
    shared=CASE WHEN input.deleted THEN input.shared ELSE target.shared END,
    native_sources=CASE WHEN input.deleted THEN input.native_sources ELSE target.native_sources END
    FROM jsonb_to_recordset(${batch}::jsonb) AS input(record_id text,meta jsonb,base text,deleted boolean,value jsonb,asset jsonb,shared jsonb,native_sources jsonb)
    WHERE target.owner_id=(SELECT id FROM owners WHERE project_id=${owner.workbenchId} AND extension_id=${owner.extensionId}) AND target.record_id=input.record_id`);
  const retained = previous.filter((row) => row.retained).map((row) => row.recordId);
  const pages = createRetainedPages(tx, owner, "tombstones");
  for (const { recordId } of records) if (!before.has(recordId) && (await pages.has(recordId))) retained.push(recordId);
  if (retained.length) await removeRetainedRecords(tx, owner, retained);
  noteRecordPublication(
    tx,
    owner,
    records.map((record) => record.recordId),
  );

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
