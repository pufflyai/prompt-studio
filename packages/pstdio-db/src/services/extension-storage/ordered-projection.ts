import { and, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import { assertStorageLimits } from "pstdio-sync-contracts";
import { records as current, owners as projections } from "../../db/schemas.pg";
import { orderedCommitVersionColumns } from "./ordered-commit-cache";
import { projectOrderedNativeAssets } from "./ordered-native-assets";
import { refreshOrderedNativeVersions } from "./ordered-native-versions";
import {
  noteRecordPublication,
  type OrderedPublicationBaseline,
  orderedProjectionFacets,
} from "./ordered-record-publication";
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
  options: {
    confirmed?: ReadonlyMap<string, OrderedRecord>;
    hasPending?: boolean;
    previous?: OrderedPublicationBaseline;
  } = {},
) => {
  if (!records.length) return { records: [], projected: 0 };
  const facets = await orderedProjectionFacets(tx, owner, records, options);
  const ids = records.map(({ recordId }) => recordId).filter((id) => !options.previous?.has(id));
  const loaded = ids.length
    ? await tx
        .select({
          recordId: current.record_id,
          deleted: current.deleted,
          nativeSources: current.native_sources,
          retained: sql<boolean>`coalesce(${current.meta}->>'retained'='1', false)`,
        })
        .from(current)
        .where(
          and(orderedOwnerWhere(current, owner), sql`${current.revision} IS NOT NULL`, inArray(current.record_id, ids)),
        )
    : [];
  const previous = [
    ...loaded,
    ...records.flatMap(({ recordId }) => {
      const row = options.previous?.get(recordId);
      return row ? [{ ...row }] : [];
    }),
  ];
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
  const projected = await writeProjectedRecords(tx, owner, materialized, facets);
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
  const version = projected
    ? (
        await tx
          .update(projections)
          .set({ revision: sql`${projections.revision} + 1`, live_count: sql`${projections.live_count} + ${delta}` })
          .where(orderedOwnerWhere(projections, owner))
          .returning(orderedCommitVersionColumns)
      )[0]
    : undefined;
  return { records: materialized, projected, version: version && JSON.stringify(version) };
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
