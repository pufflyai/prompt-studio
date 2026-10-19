import { and, eq, sql } from "drizzle-orm";
import type { createRelayAssets } from "../assets/assets";
import type { RelayLimits } from "../limits";
import { lockAccount } from "./accounts";
import { blobOwner } from "./blobs";
import type { connectRelay } from "./database";
import { syncBlobs, syncObjectDeletions } from "./document-schema";
import type { PayloadObjects } from "./payloads";

const batchSize = 500;

// A blob is unused when no stored update or latest state lists it. Replaced states and covered updates
// stay stored for the grace period, so a blob they used also stays at least that long (R21).
const unusedBlob = (cutoff: Date) => sql`(
  (b."status" = 'open' AND b."createdAt" <= ${cutoff})
  OR (b."status" = 'completed' AND b."completedAt" <= ${cutoff}
    AND NOT EXISTS (SELECT 1 FROM relay_sync_updates u
      WHERE u."projectId" = b."projectId" AND u."blobIds" @> ARRAY[b."blobId"])
    AND NOT EXISTS (SELECT 1 FROM relay_sync_states s
      WHERE s."projectId" = b."projectId" AND s."blobIds" @> ARRAY[b."blobId"]))
)`;

export interface SyncCleanupOptions {
  connection: ReturnType<typeof connectRelay>;
  payloads: PayloadObjects;
  assets: ReturnType<typeof createRelayAssets>;
  limits: RelayLimits;
}

/** Removes what the grace period no longer protects (R20, R21, R23). Safe to repeat and to run on several replicas. */
export const cleanupSync = async (
  { connection, payloads, assets, limits }: SyncCleanupOptions,
  now = new Date(),
  signal?: AbortSignal,
) => {
  const cutoff = new Date(now.getTime() - limits.gracePeriodMs);
  // Rows and their deletion entries commit together, so no payload object loses its last reference.
  await connection.run(
    (db) =>
      db.execute(sql`
        WITH gone AS (DELETE FROM relay_sync_updates WHERE "coveredAt" <= ${cutoff} RETURNING "objectKey")
        INSERT INTO relay_sync_object_deletions SELECT "objectKey" FROM gone ON CONFLICT DO NOTHING`),
    signal,
  );
  await connection.run(
    (db) =>
      db.execute(sql`
        WITH gone AS (DELETE FROM relay_sync_states WHERE "replacedAt" <= ${cutoff} RETURNING "objectKey")
        INSERT INTO relay_sync_object_deletions SELECT "objectKey" FROM gone ON CONFLICT DO NOTHING`),
    signal,
  );

  const accounts = await connection.run(
    (db) =>
      db.execute<{ accountId: string }>(sql`
        SELECT DISTINCT p."accountId" FROM relay_sync_blobs b
        JOIN relay_sync_projects p ON p."projectId" = b."projectId" WHERE ${unusedBlob(cutoff)}`),
    signal,
  );
  // Writes that add blob references hold the same account lock, so no update can start using a blob
  // between this check and its removal.
  for (const { accountId } of accounts.rows)
    await connection.run(
      (db) =>
        db.transaction(async (transaction) => {
          await lockAccount(transaction, accountId);
          await transaction.execute(sql`
            UPDATE relay_sync_blobs b SET "status" = 'deleting' FROM relay_sync_projects p
            WHERE p."projectId" = b."projectId" AND p."accountId" = ${accountId} AND ${unusedBlob(cutoff)}`);
        }),
      signal,
    );
  const deleting = await connection.run(
    (db) => db.select().from(syncBlobs).where(eq(syncBlobs.status, "deleting")),
    signal,
  );
  for (const blob of deleting) {
    await assets.remove(blobOwner(blob), blob.blobId);
    await connection.run(
      (db) =>
        db.delete(syncBlobs).where(and(eq(syncBlobs.projectId, blob.projectId), eq(syncBlobs.blobId, blob.blobId))),
      signal,
    );
  }

  while (true) {
    const keys = await connection.run((db) => db.select().from(syncObjectDeletions).limit(batchSize), signal);
    for (const { objectKey } of keys) {
      await payloads.remove(objectKey, signal);
      await connection.run(
        (db) => db.delete(syncObjectDeletions).where(eq(syncObjectDeletions.objectKey, objectKey)),
        signal,
      );
    }
    if (keys.length < batchSize) return;
  }
};

/** Runs cleanup on an interval, one run at a time. Stopping interrupts the current run. */
export const scheduleSyncCleanup = (
  run: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  failed: () => void,
) => {
  const controller = new AbortController();
  let running: Promise<void> | undefined;
  const timer = setInterval(() => {
    running ??= run(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) failed();
      })
      .finally(() => {
        running = undefined;
      });
  }, intervalMs);
  return async () => {
    clearInterval(timer);
    controller.abort();
    await running;
  };
};
