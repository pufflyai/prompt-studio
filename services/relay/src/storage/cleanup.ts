import { eq, lte, sql } from "drizzle-orm";
import type { createRelayAssets } from "../assets/assets";
import type { RelayLimits } from "../limits";
import { removeRows } from "./accounts";
import { cleanupBlobGraph } from "./blob-graph-cleanup";
import type { connectRelay } from "./database";
import { syncObjectDeletions, syncStates, syncUpdates } from "./document-schema";
import type { PayloadObjects } from "./payloads";

const batchSize = 500;

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

  await cleanupBlobGraph(connection, assets, cutoff, signal);

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
