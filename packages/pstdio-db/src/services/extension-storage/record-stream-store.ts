import { and, eq, inArray, isNotNull, max } from "drizzle-orm";
import type { DocumentStore, StorageOwner } from "pstdio-sync";
import { type RecordFrame, type RecordStreamCursor, type RecordStreamStore, recordFrameLimit } from "pstdio-sync/relay";
import { type Asset, type AssetReference, assetReferenceSchema } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_current_records, storage_record_outbox, storage_record_sync } from "../../db/schemas.pg";
import type { createProjectionStatistics } from "./projection-statistics";
import { lockRecordOwner, saveRecordChanges } from "./record-changes";
import { dropRecordOutbox, queueRecordBytes, readRecordOutbox } from "./record-outbox";
import { acceptFrames, adoptRecords, localRecordIds, mergeRecords, recordStates } from "./record-stream-merge";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const cursorOf = (row: typeof storage_record_sync.$inferSelect): RecordStreamCursor => ({
  joined: row.joined,
  after: row.after,
  stateId: row.state_id,
  through: row.through,
  pendingBytes: row.pending_bytes,
  stateBytes: row.state_bytes,
});

/** One owner's records as its encrypted relay stream reads and writes them. */
export const createRecordStreamStore = (
  db: DbClient,
  owner: StorageOwner,
  deps: {
    upgrade: () => Promise<void>;
    statistics: ReturnType<typeof createProjectionStatistics>;
    /** Notifies owner watchers after downloaded records change. */
    changed: () => void;
    /** The owner's metadata document, which remembers where each asset's ciphertext lives. */
    metadata: DocumentStore["transaction"];
  },
) => {
  const syncWhere = and(
    eq(storage_record_sync.workbench_id, owner.workbenchId),
    eq(storage_record_sync.extension_id, owner.extensionId),
  );
  const saveCursor = (tx: Transaction, cursor: RecordStreamCursor) =>
    tx
      .update(storage_record_sync)
      .set({
        joined: cursor.joined,
        after: cursor.after,
        state_id: cursor.stateId,
        through: cursor.through,
        pending_bytes: cursor.pendingBytes,
        state_bytes: cursor.stateBytes,
      })
      .where(syncWhere);
  /** Runs a record write under the owner lock and notifies watchers once it commits. */
  const write = async (
    run: (tx: Transaction, revision: number) => Promise<{ projected: number; changed: boolean; rejected: string[] }>,
  ) => {
    await deps.upgrade();
    const result = await db.transaction(async (tx) => run(tx, await lockRecordOwner(tx, owner)));
    if (result.projected) deps.statistics.record(result.projected);
    if (result.changed) deps.changed();
    return result.rejected;
  };
  const save = async (tx: Transaction, revision: number, changes: Parameters<typeof saveRecordChanges>[3]) =>
    changes.length ? saveRecordChanges(tx, owner, revision, changes) : 0;
  /** The current file of each live record that has one. */
  const currentAssets = async (connection: Pick<DbClient, "select">, recordIds: string[]) => {
    const assets = new Map<string, Asset>();
    for (let offset = 0; offset < recordIds.length; offset += 1_000) {
      const rows = await connection
        .select({ id: storage_current_records.record_id, asset: storage_current_records.asset })
        .from(storage_current_records)
        .where(
          and(
            eq(storage_current_records.workbench_id, owner.workbenchId),
            eq(storage_current_records.extension_id, owner.extensionId),
            inArray(storage_current_records.record_id, recordIds.slice(offset, offset + 1_000)),
            eq(storage_current_records.deleted, false),
            isNotNull(storage_current_records.asset),
          ),
        );
      for (const row of rows) if (row.asset) assets.set(row.id, row.asset);
    }
    return assets;
  };
  const references = {
    get: (sha256: string) =>
      deps.metadata(owner, async ({ document }) => {
        const parsed = assetReferenceSchema.safeParse(document.getMap("record-blobs").get(sha256));
        return parsed.success ? parsed.data : undefined;
      }),
    set: (reference: AssetReference) =>
      deps.metadata(owner, async ({ document }) => {
        document.getMap("record-blobs").set(reference.asset.sha256, reference);
      }),
  };
  return {
    references,
    async open() {
      await deps.upgrade();
      await db
        .insert(storage_record_sync)
        .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId })
        .onConflictDoNothing();
      const [row] = await db.select().from(storage_record_sync).where(syncWhere);
      return cursorOf(row!);
    },
    async apply(frames: (RecordFrame | null)[], cursor: RecordStreamCursor) {
      let rejectedFrames: number[] = [];
      await write(async (tx, revision) => {
        const { accepted, rejected } = await acceptFrames(tx, owner, frames);
        rejectedFrames = rejected;
        const { changes } = await mergeRecords(tx, owner, accepted, false);
        const projected = await save(tx, revision, changes);
        await saveCursor(tx, cursor);
        return { projected, changed: changes.length > 0, rejected: [] };
      });
      return rejectedFrames;
    },
    async merge(remote: Map<string, Uint8Array[]>, mode: "adopt" | "repair", cursor: RecordStreamCursor) {
      return write(async (tx, revision) => {
        // Adopting replaces this device's record histories, so saves queued against them are folded in.
        if (mode === "adopt") await dropRecordOutbox(tx, owner);
        const merged =
          mode === "adopt"
            ? await adoptRecords(tx, owner, remote)
            : await mergeRecords(tx, owner, remote, true).then((result) => ({ ...result, uploads: result.missing }));
        const projected = await save(tx, revision, merged.changes);
        const localOnly = (await localRecordIds(tx, owner)).filter((id) => !remote.has(id));
        const uploads = [...merged.uploads, ...(await recordStates(tx, owner, localOnly))];
        const assets = await currentAssets(
          tx,
          uploads.map((upload) => upload.recordId),
        );
        await queueRecordBytes(tx, owner, uploads, assets, recordFrameLimit);
        await saveCursor(tx, cursor);
        return { projected, changed: merged.changes.length > 0, rejected: merged.rejected };
      });
    },
    outbox: (limit: number) => readRecordOutbox(db, owner, limit),
    async sent(sequence: number) {
      await dropRecordOutbox(db, owner, sequence);
    },
    async snapshot() {
      await deps.upgrade();
      return db.transaction(async (tx) => {
        const [{ outbox }] = (await tx
          .select({ outbox: max(storage_record_outbox.sequence) })
          .from(storage_record_outbox)
          .where(
            and(
              eq(storage_record_outbox.workbench_id, owner.workbenchId),
              eq(storage_record_outbox.extension_id, owner.extensionId),
            ),
          )) as [{ outbox: number | null }];
        return { records: await recordStates(tx, owner, await localRecordIds(tx, owner)), outbox: outbox ?? 0 };
      });
    },
    async published(cursor: RecordStreamCursor, outbox: number) {
      await db.transaction(async (tx) => {
        await dropRecordOutbox(tx, owner, outbox);
        await saveCursor(tx, cursor);
      });
    },
    hasRecords: async () => (await localRecordIds(db, owner, 1)).length > 0,
    assets: async (recordIds: string[]) => [...(await currentAssets(db, recordIds)).values()],
    async pending() {
      const rows = await db
        .select({ sequence: storage_record_outbox.sequence })
        .from(storage_record_outbox)
        .where(
          and(
            eq(storage_record_outbox.workbench_id, owner.workbenchId),
            eq(storage_record_outbox.extension_id, owner.extensionId),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },
  } satisfies RecordStreamStore;
};
