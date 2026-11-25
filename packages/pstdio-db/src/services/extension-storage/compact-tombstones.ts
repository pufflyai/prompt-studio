import { and, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { owners, records } from "../../db/schemas.pg";
import { withOrderedOwner } from "./ordered-journal";
import { canonicalRecordFromRow } from "./ordered-record-row";
import { orderedOwnerWhere } from "./ordered-sql";
import { createRetainedPages } from "./retained-pages";
import { compactedRecordMetadata, type RetainedRecord } from "./retained-records";

/** One owner-locked, byte-bounded batch. Pending overlays retain their confirmed bases. */
export const compactOrderedTombstones = (db: DbClient, owner: StorageOwner) =>
  withOrderedOwner(db, owner, async (_journal, tx) => {
    const candidates = await tx
      .select({
        id: records.record_id,
        bytes: sql<number>`octet_length(row_to_json(records)::text)`,
      })
      .from(records)
      .where(
        and(
          orderedOwnerWhere(records, owner),
          sql`${records.deleted}=true`,
          isNull(records.base),
          isNotNull(records.meta),
          isNotNull(records.revision),
          sql`${records.meta}->'retained' IS DISTINCT FROM '1'::jsonb`,
        ),
      )
      .orderBy(records.record_id)
      .limit(100);
    const ids: string[] = [];
    let bytes = 0;
    for (const row of candidates) {
      if (ids.length && bytes + Number(row.bytes) > 4 * 1024 * 1024) break;
      ids.push(row.id);
      bytes += Number(row.bytes);
    }
    if (!ids.length) return 0;
    const rows = await tx
      .select()
      .from(records)
      .where(and(orderedOwnerWhere(records, owner), inArray(records.record_id, ids)));
    const compactedAt = new Date().toISOString();
    const values = rows.map((row) => {
      const record = canonicalRecordFromRow(row);
      if (!record?.deleted || !row.revision) throw new Error("Only published confirmed tombstones can be compacted");
      return { key: row.record_id, value: { record, revision: row.revision, compactedAt } satisfies RetainedRecord };
    });
    await createRetainedPages<RetainedRecord>(tx, owner, "tombstones").set(values);
    for (const {
      value: { record },
    } of values)
      await tx
        .update(records)
        .set({
          value: null,
          asset: null,
          shared: null,
          query_values: {},
          native_sources: {},
          native_versions: {},
          meta: compactedRecordMetadata(record),
        })
        .where(and(orderedOwnerWhere(records, owner), sql`${records.record_id}=${record.recordId}`));
    return values.length;
  });

/** Quiet maintenance yields between owner batches and retries damaged owners next pass. */
export const compactStorageTombstones = async (db: DbClient, stopped: () => boolean) => {
  let after = 0;
  while (!stopped()) {
    const [owner] = await db
      .select({ id: owners.id, project_id: owners.project_id, extension_id: owners.extension_id })
      .from(owners)
      .where(sql`${owners.id}>${after} AND EXISTS (
      SELECT 1 FROM records WHERE owner_id=${owners.id} AND deleted=true AND base IS NULL
        AND meta IS NOT NULL AND revision IS NOT NULL AND meta->'retained' IS DISTINCT FROM '1'::jsonb
    )`)
      .orderBy(owners.id)
      .limit(1);
    if (!owner) return;
    after = owner.id;
    const address = { workbenchId: owner.project_id, extensionId: owner.extension_id };
    try {
      while (!stopped()) {
        await Bun.sleep(0);
        if (stopped() || !(await compactOrderedTombstones(db, address))) break;
      }
    } catch (error) {
      console.warn("Tombstone compaction will retry on the next quiet pass", error);
    }
  }
};
