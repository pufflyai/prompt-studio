import { and, eq, inArray, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { owners, records } from "../../db/schemas.pg";
import { type OrderedJournal, withOrderedOwner } from "./ordered-journal";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { orderedOwnerJoinedCloud, readOrderedOwner } from "./ordered-stream-state";
import { createRetainedPages } from "./retained-pages";
import { canonicalRetainedRecord, type RetainedRecord, readRetainedRecord } from "./retained-records";

const eligibleRows = () => sql`${records.deleted}=true AND ${records.base} IS NULL
  AND ${records.revision} IS NOT NULL AND ${records.meta}->>'retained'='1'
  AND NOT EXISTS (SELECT 1 FROM operations pending WHERE pending.owner_id=${records.owner_id}
    AND pending.envelope IS NOT NULL AND pending.settled_epoch IS NULL AND pending.touches @> ARRAY[${records.record_id}])`;

const publishedDeletion = async (journal: OrderedJournal, lifetime: string) => {
  let stamp: unknown;
  try {
    stamp = JSON.parse(lifetime);
  } catch {
    return false;
  }
  if (
    !Array.isArray(stamp) ||
    stamp.length !== 3 ||
    stamp[0] !== "canonical" ||
    typeof stamp[1] !== "string" ||
    typeof stamp[2] !== "string"
  )
    return false;
  return (await journal.publishedReceipt(stamp[2], stamp[1]))?.state === "accepted";
};

const expiredDeletion = async (journal: OrderedJournal, cloud: boolean, saved: RetainedRecord, now: Date) => {
  if (!cloud) return Date.parse(saved.compactedAt) <= now.getTime() - 30 * 86_400_000;
  const record = saved.record;
  return record.stamps[""] === record.lifetime && (await publishedDeletion(journal, record.lifetime));
};

const readPurgeAuthority = async (tx: OrderedTransaction, owner: StorageOwner, id: string) => {
  const [row] = await tx
    .select()
    .from(records)
    .where(and(orderedOwnerWhere(records, owner), eq(records.record_id, id)));
  const saved = await readRetainedRecord(tx, owner, id);
  if (!row || !saved || saved.revision !== row.revision)
    throw new Error("The retained deletion does not match its published observation");
  canonicalRetainedRecord(row, saved);
  return saved;
};

/** Purging SQL never deletes recovery authority. Seek past ineligible rows so older entries cannot starve. */
export const purgeOrderedTombstones = (db: DbClient, owner: StorageOwner, now = new Date(), after?: string) =>
  withOrderedOwner(db, owner, async (journal, tx) => {
    const candidates = await tx
      .select({ id: records.record_id, bytes: sql<number>`octet_length(row_to_json(records)::text)` })
      .from(records)
      .where(
        and(
          orderedOwnerWhere(records, owner),
          eligibleRows(),
          after === undefined ? undefined : sql`${records.record_id}>${after}`,
        ),
      )
      .orderBy(records.record_id)
      .limit(100);
    const pages = createRetainedPages(tx, owner, "tombstones");
    const cloud = orderedOwnerJoinedCloud(await readOrderedOwner(tx, owner));
    const ids: string[] = [];
    let bytes = 0,
      cursor: string | undefined;
    for (const candidate of candidates) {
      const extent = await pages.bytes(candidate.id);
      if (extent === undefined) throw new Error("The compacted record's retained value is missing");
      const size = Number(candidate.bytes) + extent;
      if (cursor !== undefined && bytes + size > 4 * 1024 * 1024) break;
      const saved = await readPurgeAuthority(tx, owner, candidate.id);
      bytes += size;
      cursor = candidate.id;
      if (await expiredDeletion(journal, cloud, saved, now)) ids.push(candidate.id);
    }
    if (ids.length)
      await tx.delete(records).where(and(orderedOwnerWhere(records, owner), inArray(records.record_id, ids)));
    return { removed: ids.length, after: cursor };
  });

/** Runtime-only, owner-isolated maintenance. Every batch observes quiet/shutdown before starting. */
export const purgeStorageTombstones = async (db: DbClient, stopped: () => boolean, now = new Date()) => {
  let afterOwner = 0;
  while (!stopped()) {
    const [owner] = await db
      .select({ id: owners.id, project_id: owners.project_id, extension_id: owners.extension_id })
      .from(owners)
      .where(sql`${owners.id}>${afterOwner} AND EXISTS (SELECT 1 FROM records
        WHERE owner_id=${owners.id} AND deleted=true AND base IS NULL AND revision IS NOT NULL AND meta->>'retained'='1')`)
      .orderBy(owners.id)
      .limit(1);
    if (!owner) return;
    afterOwner = owner.id;
    try {
      let after: string | undefined;
      while (!stopped()) {
        await Bun.sleep(0);
        if (stopped()) break;
        const batch = await purgeOrderedTombstones(
          db,
          { workbenchId: owner.project_id, extensionId: owner.extension_id },
          now,
          after,
        );
        if (batch.after === undefined) break;
        after = batch.after;
      }
    } catch (error) {
      console.warn("Tombstone purge will retry on the next quiet pass", error);
    }
  }
};
