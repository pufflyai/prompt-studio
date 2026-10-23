import { and, eq, lte, sql } from "drizzle-orm";
import type { createRelayAssets } from "../assets/assets";
import type { RelayLimits } from "../limits";
import { lockAccount, removeRows } from "./accounts";
import { protectedBlobGraph } from "./blob-graph";
import { blobOwner } from "./blobs";
import type { connectRelay } from "./database";
import { syncBlobs, syncObjectDeletions, syncStates, syncUpdates } from "./document-schema";
import type { PayloadObjects } from "./payloads";

const batchSize = 500;

// A blob is unused when no stored update or latest state lists it and its last use is older than the
// grace period (R21). Unfinished uploads expire after the grace period too.
const unusedBlob = (cutoff: Date) => sql`(
  (b."status" = 'open' AND b."createdAt" <= ${cutoff})
  OR (b."status" = 'completed' AND coalesce(b."lastUsedAt", b."completedAt") <= ${cutoff}
    AND NOT EXISTS (SELECT 1 FROM protected p
      WHERE p."projectKey" = b."projectKey" AND p."blobId" = b."blobId"))
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
  await connection.run(
    (db) => db.execute(removeRows("relay_sync_updates", lte(syncUpdates.coveredAt, cutoff), now)),
    signal,
  );
  await connection.run(
    (db) => db.execute(removeRows("relay_sync_states", lte(syncStates.replacedAt, cutoff), now)),
    signal,
  );

  const accounts = await connection.run(
    (db) =>
      db.execute<{ accountId: string }>(sql`
        ${protectedBlobGraph(cutoff)}
        SELECT DISTINCT p."accountId" FROM relay_sync_blobs b
        JOIN relay_sync_projects p ON p."projectKey" = b."projectKey" WHERE ${unusedBlob(cutoff)}`),
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
            ${protectedBlobGraph(cutoff)}
            UPDATE relay_sync_blobs b SET "status" = 'deleting' FROM relay_sync_projects p
            WHERE p."projectKey" = b."projectKey" AND p."accountId" = ${accountId} AND ${unusedBlob(cutoff)}`);
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
        db.delete(syncBlobs).where(and(eq(syncBlobs.projectKey, blob.projectKey), eq(syncBlobs.blobId, blob.blobId))),
      signal,
    );
  }

  while (true) {
    const keys = await connection.run((db) => db.select().from(syncObjectDeletions).limit(batchSize), signal);
    for (const { objectKey } of keys) {
      // A write whose commit reply was lost queues its key even though its row may exist.
      // Keys are random and used once, so a key without a row never gains one later.
      const referenced = await connection.run(
        (db) =>
          db.execute<{ referenced: boolean }>(sql`
            SELECT EXISTS (SELECT 1 FROM relay_sync_updates WHERE "objectKey" = ${objectKey})
              OR EXISTS (SELECT 1 FROM relay_sync_states WHERE "objectKey" = ${objectKey}) AS referenced`),
        signal,
      );
      if (!referenced.rows[0]!.referenced) await payloads.remove(objectKey, signal);
      await connection.run(
        (db) => db.delete(syncObjectDeletions).where(eq(syncObjectDeletions.objectKey, objectKey)),
        signal,
      );
    }
    if (keys.length < batchSize) return;
  }
};

/** Runs cleanup now and then on an interval, one run at a time. Stopping interrupts the current run. */
export const scheduleSyncCleanup = (
  run: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  failed: () => void,
) => {
  const controller = new AbortController();
  let running: Promise<void> | undefined;
  const start = () => {
    running ??= run(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) failed();
      })
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(start, intervalMs);
  start();
  return async () => {
    clearInterval(timer);
    controller.abort();
    await running;
  };
};
