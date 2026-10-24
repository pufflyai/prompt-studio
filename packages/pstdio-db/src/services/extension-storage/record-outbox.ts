import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { decodeRecordFrame, encodeRecordFrame, type RecordBytes } from "pstdio-sync/relay";
import type { DbClient } from "../../db/connection.pglite";
import { storage_record_outbox } from "../../db/schemas.pg";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const ownerWhere = (owner: StorageOwner) =>
  and(
    eq(storage_record_outbox.workbench_id, owner.workbenchId),
    eq(storage_record_outbox.extension_id, owner.extensionId),
  );

/**
 * Keeps one local save's record updates for upload, in the save's transaction. Owners that do not
 * sync have no stream row, so nothing is kept for them.
 */
export const queueRecordUpload = async (
  tx: Transaction,
  owner: StorageOwner,
  prepared: { id: string; record: { recordId: string }; update: Uint8Array | null }[],
) => {
  const records = prepared.flatMap((change) =>
    change.update ? [{ recordId: change.record.recordId, bytes: change.update }] : [],
  );
  if (!records.length) return;
  const frame = Buffer.from(encodeRecordFrame({ records, assets: [] })).toString("hex");
  await tx.execute(sql`
    INSERT INTO storage_record_outbox (workbench_id, extension_id, frame)
    SELECT workbench_id, extension_id, decode(${frame}, 'hex') FROM storage_record_sync
    WHERE workbench_id = ${owner.workbenchId} AND extension_id = ${owner.extensionId}
  `);
};

/** Queues record bytes that are not tied to one save, split under the frame limit. */
export const queueRecordBytes = async (tx: Transaction, owner: StorageOwner, records: RecordBytes[], limit: number) => {
  let batch: RecordBytes[] = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    await tx.insert(storage_record_outbox).values({
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      frame: encodeRecordFrame({ records: batch, assets: [] }),
    });
    batch = [];
    size = 0;
  };
  for (const record of records) {
    if (size + record.bytes.length > limit) await flush();
    batch.push(record);
    size += record.bytes.length + record.recordId.length;
  }
  await flush();
};

export const readRecordOutbox = async (db: Pick<DbClient, "select">, owner: StorageOwner, limit: number) => {
  const rows = await db
    .select()
    .from(storage_record_outbox)
    .where(ownerWhere(owner))
    .orderBy(asc(storage_record_outbox.sequence))
    .limit(64);
  const entries: { sequence: number; records: RecordBytes[] }[] = [];
  let size = 0;
  for (const row of rows) {
    if (entries.length && size + row.frame.length > limit) break;
    entries.push({ sequence: row.sequence, records: decodeRecordFrame(row.frame).records });
    size += row.frame.length;
  }
  return entries;
};

export const dropRecordOutbox = (tx: Pick<DbClient, "delete">, owner: StorageOwner, through?: number) =>
  tx
    .delete(storage_record_outbox)
    .where(
      through === undefined ? ownerWhere(owner) : and(ownerWhere(owner), lte(storage_record_outbox.sequence, through)),
    );
