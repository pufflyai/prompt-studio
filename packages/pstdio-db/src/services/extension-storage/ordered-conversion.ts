import { and, desc, gt, inArray, lt, type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId } from "pstdio-sync/records";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_current_records as current,
  storage_documents as documents,
  storage_record_outbox as outbox,
  storage_ordered_owners as owners,
  storage_record_projections as projections,
} from "../../db/schemas.pg";
import { planLegacyBatch } from "./ordered-conversion-plan";
import { conversionPendingPage, projectConversionBatch, publishConvertedPage } from "./ordered-conversion-projection";
import {
  type ConversionCursor,
  type ConversionRecord,
  conversionId,
  conversionRecordId,
  readConversion,
  readConversionValues,
  saveConversion,
} from "./ordered-conversion-state";
import { createOrderedJournal } from "./ordered-journal";
import { stripLegacyPendingPaths } from "./ordered-legacy-baseline";
import { migrateLegacyPendingBatch } from "./ordered-legacy-pending";
import { convertLegacyOrderedRecords } from "./ordered-legacy-record";
import { settleLocalOrderedSaves } from "./ordered-local-settlement";
import { indexInitialCanonicalNumbers } from "./ordered-number-canonical";
import { retainNumberHistory } from "./ordered-number-values";
import { publishOrderedProjection } from "./ordered-projection";
import { type OrderedTransaction, orderedOwnerWhere } from "./ordered-sql";
import { orderedOwnerJoinedCloud, readOrderedOwner } from "./ordered-stream-state";
import { lockRecordOwner } from "./record-changes";
import { readProjectedRecords } from "./record-queries";

const jobs = new WeakMap<DbClient, Map<string, { promise: Promise<void>; signals: Set<AbortSignal> }>>();
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
    if (await orderedOwnerJoinedCloud(tx, owner, await readOrderedOwner(tx, owner)))
      return advance(tx, owner, "project");
    const page = await conversionPendingPage(journal, cursor.sequence);
    if (!page.length) return advance(tx, owner, "project");
    await settleLocalOrderedSaves(journal, tx, owner, page);
    return saveConversion(tx, owner, { phase: "settle", sequence: page.at(-1)!.sequence });
  }
  if (cursor.phase === "cleanup") {
    const rows = await tx
      .select({ id: documents.document_id })
      .from(documents)
      .where(
        and(
          orderedOwnerWhere(documents, owner),
          sql`starts_with(${documents.document_id}, '["ordered-conversion-')`,
          cursor.after === undefined ? undefined : gt(documents.document_id, cursor.after),
        ),
      )
      .orderBy(documents.document_id)
      .limit(100);
    const ids = rows.length ? rows.map((row) => row.id) : [conversionId];
    await tx.delete(documents).where(and(orderedOwnerWhere(documents, owner), inArray(documents.document_id, ids)));
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
      .where(and(orderedOwnerWhere(documents, owner), inArray(documents.document_id, ids.map(conversionRecordId))));
  } else {
    await publishConvertedPage(journal, tx, owner, ids);
  }
  await saveConversion(tx, owner, { phase: cursor.phase, after: ids.at(-1)! });
};

/** Single-flight per database/owner. A failed or interrupted job retries from its durable cursor. */
export const ensureOrderedOwner = (db: DbClient, owner: StorageOwner, signal?: AbortSignal) => {
  let active = jobs.get(db);
  if (!active) {
    active = new Map();
    jobs.set(db, active);
  }
  const key = JSON.stringify([owner.workbenchId, owner.extensionId]);
  const previous = active.get(key);
  if (previous) {
    if (signal) previous.signals.add(signal);
    return previous.promise;
  }
  const signals = new Set(signal ? [signal] : []);
  const checkAbort = () => {
    for (const signal of signals) signal.throwIfAborted();
  };
  const run = (async () => {
    checkAbort();
    const [existing] = await db
      .select({ id: owners.workbench_id })
      .from(owners)
      .where(orderedOwnerWhere(owners, owner));
    if (existing && !(await readConversion(db, owner))) return;
    if (!existing)
      await db.transaction(async (tx) => {
        await lockRecordOwner(tx, owner);
        const created = await tx
          .insert(owners)
          .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId })
          .onConflictDoNothing()
          .returning({ id: owners.workbench_id });
        if (created.length) {
          const [legacy] = await tx
            .select({
              present: sql<boolean>`EXISTS (SELECT 1 FROM storage_current_records WHERE workbench_id=${owner.workbenchId} AND extension_id=${owner.extensionId}) OR EXISTS (SELECT 1 FROM storage_record_outbox WHERE workbench_id=${owner.workbenchId} AND extension_id=${owner.extensionId})`,
            })
            .from(owners)
            .where(orderedOwnerWhere(owners, owner));
          if (legacy?.present) await saveConversion(tx, owner, { phase: "records" });
        }
      });
    while (true) {
      await yieldTurn();
      checkAbort();
      const cursor = await readConversion(db, owner);
      if (!cursor) return;
      await db.transaction(async (tx) => {
        await lockRecordOwner(tx, owner);
        const current = await readConversion(tx, owner);
        if (current) await convertBatch(tx, owner, current);
      });
    }
  })().finally(() => {
    active.delete(key);
  });
  active.set(key, { promise: run, signals });
  return run;
};

/** Startup starts owners independently; a corrupt owner's input cannot roll back its neighbors. */
export const convertLegacyOwners = async (
  db: DbClient,
  options: { signal?: AbortSignal; onError(owner: StorageOwner, error: unknown): void },
) => {
  let after: { workbenchId: string; extensionId: string } | undefined;
  while (!options.signal?.aborted) {
    const [row] = await db
      .select({ workbenchId: projections.workbench_id, extensionId: projections.extension_id })
      .from(projections)
      .where(
        after
          ? sql`(${projections.workbench_id}, ${projections.extension_id}) > (${after.workbenchId}, ${after.extensionId})`
          : undefined,
      )
      .orderBy(projections.workbench_id, projections.extension_id)
      .limit(1);
    if (!row) return;
    try {
      await ensureOrderedOwner(db, row, options.signal);
    } catch (error) {
      if (!options.signal?.aborted) options.onError(row, error);
    }
    after = row;
  }
};
