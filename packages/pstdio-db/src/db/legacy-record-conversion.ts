import { and, desc, gt, inArray, lt, type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId } from "pstdio-sync/records";
import { createOrderedJournal } from "../services/extension-storage/ordered-journal";
import { settleLocalOrderedSaves } from "../services/extension-storage/ordered-local-settlement";
import { indexInitialCanonicalNumbers } from "../services/extension-storage/ordered-number-canonical";
import { retainNumberHistory } from "../services/extension-storage/ordered-number-values";
import { publishOrderedProjection } from "../services/extension-storage/ordered-projection";
import { type OrderedTransaction, orderedOwnerWhere } from "../services/extension-storage/ordered-sql";
import { orderedOwnerJoinedCloud, readOrderedOwner } from "../services/extension-storage/ordered-stream-state";
import { readProjectedRecords } from "../services/extension-storage/record-queries";
import { ensureStorageOwner, storageOwnerKey } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { planLegacyBatch } from "./legacy-records/ordered-conversion-plan";
import {
  conversionPendingPage,
  projectConversionBatch,
  publishConvertedPage,
} from "./legacy-records/ordered-conversion-projection";
import {
  type ConversionCursor,
  type ConversionRecord,
  conversionId,
  conversionRecordId,
  readConversion,
  readConversionValues,
  saveConversion,
} from "./legacy-records/ordered-conversion-state";
import { stripLegacyPendingPaths } from "./legacy-records/ordered-legacy-baseline";
import { migrateLegacyPendingBatch } from "./legacy-records/ordered-legacy-pending";
import { convertLegacyOrderedRecords } from "./legacy-records/ordered-legacy-record";
import { storage_record_outbox as outbox, storage_ordered_owners as owners } from "./legacy-records-schema";
import { documents } from "./schemas/documents";
import { records as current } from "./schemas.pg";

const yieldTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const recordPage = async (tx: OrderedTransaction, owner: StorageOwner, after?: string) =>
  (
    await tx
      .select({ id: current.record_id })
      .from(current)
      .where(and(orderedOwnerWhere(current, owner), after === undefined ? undefined : gt(current.record_id, after)))
      .orderBy(current.record_id)
      .limit(100)
  ).map((row) => row.id);

const advance = (tx: OrderedTransaction, owner: StorageOwner, phase: ConversionCursor["phase"]) =>
  saveConversion(tx, owner, { phase });

const convertFrames = async (tx: OrderedTransaction, owner: StorageOwner, cursor: ConversionCursor) => {
  const journal = createOrderedJournal(tx, owner);
  let boundary: SQL | undefined;
  if (cursor.sequence !== undefined)
    boundary = cursor.phase === "plan" ? lt(outbox.sequence, cursor.sequence) : gt(outbox.sequence, cursor.sequence);
  const reverse = cursor.phase === "plan";
  const page = await tx
    .select()
    .from(outbox)
    .where(and(orderedOwnerWhere(outbox, owner), boundary))
    .orderBy(reverse ? desc(outbox.sequence) : outbox.sequence)
    .limit(32);
  // One author frame remains atomic; otherwise cap a batch at the author-group byte limit.
  const rows = [];
  let bytes = 0;
  for (const row of page) {
    if (rows.length && bytes + row.frame.length > 4 * 1024 * 1024) break;
    rows.push(row);
    bytes += row.frame.length;
  }
  if (!rows.length) return advance(tx, owner, reverse ? "pending" : "strip");
  if (reverse) await planLegacyBatch(tx, owner, rows);
  else await migrateLegacyPendingBatch(journal, tx, owner, rows);
  return saveConversion(tx, owner, { phase: cursor.phase, sequence: rows.at(-1)!.sequence });
};

/** Only the owner's current batch holds a database transaction or a project lock. */
const convertBatch = async (tx: OrderedTransaction, owner: StorageOwner, cursor: ConversionCursor) => {
  const journal = createOrderedJournal(tx, owner);
  if (cursor.phase === "project") return projectConversionBatch(journal, tx, owner, cursor);
  if (cursor.phase === "plan" || cursor.phase === "pending") return convertFrames(tx, owner, cursor);
  if (cursor.phase === "settle") {
    if (await orderedOwnerJoinedCloud(await readOrderedOwner(tx, owner))) return advance(tx, owner, "project");
    const page = await conversionPendingPage(journal, cursor.sequence);
    if (!page.length) return advance(tx, owner, "project");
    await settleLocalOrderedSaves(journal, tx, owner, page);
    return saveConversion(tx, owner, { phase: "settle", sequence: page.at(-1)!.sequence });
  }
  if (cursor.phase === "cleanup") {
    const rows = await tx
      .select({ id: documents.key })
      .from(documents)
      .where(
        and(
          orderedOwnerWhere(documents, owner),
          sql`starts_with(${documents.key}, '["ordered-conversion-')`,
          cursor.after === undefined ? undefined : gt(documents.key, cursor.after),
        ),
      )
      .orderBy(documents.key)
      .limit(100);
    const ids = rows.length ? rows.map((row) => row.id) : [conversionId];
    await tx.delete(documents).where(and(orderedOwnerWhere(documents, owner), inArray(documents.key, ids)));
    if (rows.length) await saveConversion(tx, owner, { phase: "cleanup", after: rows.at(-1)!.id });
    return;
  }
  const ids = await recordPage(tx, owner, cursor.after);
  if (!ids.length) {
    const next = { records: "plan", strip: "settle", publish: "cleanup" } as const;
    return advance(tx, owner, next[cursor.phase]);
  }
  if (cursor.phase === "records") {
    const converted = (await convertLegacyOrderedRecords(tx, owner, await readProjectedRecords(tx, owner, ids))).map(
      (record) => (owner.extensionId === coreOwnerId ? retainNumberHistory(undefined, record) : record),
    );
    await journal.saveCanonical(converted);
    await indexInitialCanonicalNumbers(tx, owner, converted);
    await publishOrderedProjection(tx, owner, converted);
  } else if (cursor.phase === "strip") {
    const metadata = await readConversionValues<ConversionRecord>(tx, owner, ids.map(conversionRecordId));
    await stripLegacyPendingPaths(
      journal,
      tx,
      owner,
      new Map(
        ids.flatMap((id) => {
          const paths = metadata.get(conversionRecordId(id))?.paths;
          return paths?.length ? [[id, paths]] : [];
        }),
      ),
    );
    await tx
      .delete(documents)
      .where(and(orderedOwnerWhere(documents, owner), inArray(documents.key, ids.map(conversionRecordId))));
  } else {
    await publishConvertedPage(journal, tx, owner, ids);
  }
  await saveConversion(tx, owner, { phase: cursor.phase, after: ids.at(-1)! });
};

/** Admission is serialized by the database lock; each batch resumes from its durable cursor. */
export const convertLegacyOwner = async (db: DbClient, owner: StorageOwner, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  await db.execute(sql`UPDATE owners o SET joined=true FROM storage_record_sync s
    WHERE o.project_id=${owner.workbenchId} AND o.extension_id=${owner.extensionId}
      AND o.project_id=s.workbench_id AND o.extension_id=s.extension_id AND s.joined
      AND (o.epoch IS NULL OR o.epoch='' OR o.epoch LIKE 'local:%') AND NOT o.joined`);
  const [existing] = await db.select({ id: owners.extension_id }).from(owners).where(orderedOwnerWhere(owners, owner));
  if (existing && !(await readConversion(db, owner))) return;
  if (!existing)
    await db.transaction(async (tx) => {
      await ensureStorageOwner(tx, owner);
      const created = await tx
        .insert(owners)
        .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId })
        .onConflictDoNothing()
        .returning({ id: owners.extension_id });
      if (created.length) {
        const [{ present }] = (
          await tx.execute<{ present: boolean }>(sql`SELECT
          EXISTS (SELECT 1 FROM records WHERE owner_id=${storageOwnerKey(owner)})
          OR EXISTS (SELECT 1 FROM storage_record_outbox WHERE workbench_id=${owner.workbenchId}
            AND extension_id=${owner.extensionId}) AS present`)
        ).rows;
        if (present) await saveConversion(tx, owner, { phase: "records" });
      }
    });
  while (true) {
    await yieldTurn();
    signal?.throwIfAborted();
    const cursor = await readConversion(db, owner);
    if (!cursor) return;
    await db.transaction(async (tx) => {
      const current = await readConversion(tx, owner);
      if (current) await convertBatch(tx, owner, current);
    });
  }
};
