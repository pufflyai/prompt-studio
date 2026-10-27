import { and, asc, eq, lte } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { decodeRecordFrame, encodeRecordFrame, type RecordBytes } from "pstdio-sync/relay";
import type { Asset, StorageRecord } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { storage_record_outbox, storage_record_sync } from "../../db/schemas.pg";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const ownerWhere = (owner: StorageOwner) =>
  and(
    eq(storage_record_outbox.workbench_id, owner.workbenchId),
    eq(storage_record_outbox.extension_id, owner.extensionId),
  );

const recordAssets = (records: StorageRecord[]) =>
  records.flatMap((record) => (record.asset && !record.deleted ? [record.asset] : []));

const insert = (tx: Transaction, owner: StorageOwner, records: RecordBytes[], assets: Asset[]) =>
  tx.insert(storage_record_outbox).values({
    workbench_id: owner.workbenchId,
    extension_id: owner.extensionId,
    frame: encodeRecordFrame({ records, assets: [] }),
    assets,
  });

/**
 * Keeps one local save's record updates and files for upload, in the save's transaction. Owners
 * that do not sync have no stream row; their saves skip this before any encoding.
 */
export const queueRecordUpload = async (
  tx: Transaction,
  owner: StorageOwner,
  prepared: { record: StorageRecord; update: Uint8Array | null }[],
) => {
  const combined = new Map<string, { record: StorageRecord; update: Uint8Array }>();
  for (const change of prepared) {
    if (!change.update) continue;
    const previous = combined.get(change.record.recordId);
    combined.set(change.record.recordId, {
      record: change.record,
      update: previous ? Y.mergeUpdates([previous.update, change.update]) : change.update,
    });
  }
  const changed = [...combined.values()];
  if (!changed.length) return;
  const [synced] = await tx
    .select({ joined: storage_record_sync.joined })
    .from(storage_record_sync)
    .where(
      and(
        eq(storage_record_sync.workbench_id, owner.workbenchId),
        eq(storage_record_sync.extension_id, owner.extensionId),
      ),
    );
  if (!synced) return;
  const records = changed.map((change) => ({ recordId: change.record.recordId, bytes: change.update! }));
  await insert(tx, owner, records, recordAssets(changed.map((change) => change.record)));
};

/** Queues record bytes that are not tied to one save, split under the frame limit, with their files. */
export const queueRecordBytes = async (
  tx: Transaction,
  owner: StorageOwner,
  records: RecordBytes[],
  assets: Map<string, Asset>,
  limit: number,
) => {
  let batch: RecordBytes[] = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    await insert(
      tx,
      owner,
      batch,
      batch.flatMap((record) => assets.get(record.recordId) ?? []),
    );
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
  const entries: { sequence: number; records: RecordBytes[]; assets: Asset[] }[] = [];
  let size = 0;
  for (const row of rows) {
    if (entries.length && size + row.frame.length > limit) break;
    entries.push({ sequence: row.sequence, records: decodeRecordFrame(row.frame).records, assets: row.assets });
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
