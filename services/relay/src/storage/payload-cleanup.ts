import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { connectRelay, RelayTransaction } from "./database";
import { projectRetirements, syncObjectDeletions, syncStates, syncUpdates } from "./document-schema";
import type { PayloadObjects } from "./payloads";
import { tryLockProject } from "./project-access";

const batchSize = 500;

const canReclaim = async (tx: RelayTransaction, projectKey: string | null) => {
  if (!projectKey) return true;
  // A live PUT holds shared access. A retired scope owns its own durable purge queue.
  if (!(await tryLockProject(tx, projectKey))) return false;
  const [retired] = await tx.select().from(projectRetirements).where(eq(projectRetirements.projectKey, projectKey));
  return !retired;
};

const removePayloads = async (
  tx: RelayTransaction,
  payloads: PayloadObjects,
  keys: (typeof syncObjectDeletions.$inferSelect)[],
  signal: AbortSignal | undefined,
  legacyOnly: boolean,
) => {
  const objectKeys = keys.map(({ objectKey }) => objectKey);
  const present = await tx.execute<{ objectKey: string }>(sql`
    SELECT "objectKey" FROM relay_sync_updates WHERE ${inArray(syncUpdates.objectKey, objectKeys)}
    UNION
    SELECT "objectKey" FROM relay_sync_states WHERE ${inArray(syncStates.objectKey, objectKeys)}`);
  const referenced = new Set(present.rows.map(({ objectKey }) => objectKey));
  const results = await Promise.allSettled(
    keys.map(async ({ objectKey, multipartId }) => {
      if (!referenced.has(objectKey)) {
        await payloads.discard(objectKey, multipartId, signal);
        await payloads.remove(objectKey, signal);
        if (legacyOnly) await payloads.verifyRemoved(objectKey, signal);
      }
    }),
  );
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (failures.length === 1) throw failures[0];
  if (failures.length) throw new AggregateError(failures, "Payload cleanup failed");
  await tx.delete(syncObjectDeletions).where(inArray(syncObjectDeletions.objectKey, objectKeys));
};

export const cleanupPayloads = async (
  connection: ReturnType<typeof connectRelay>,
  payloads: PayloadObjects,
  signal?: AbortSignal,
  legacyOnly = false,
) => {
  let after = "";
  let firstFailure: { error: unknown } | undefined;
  while (true) {
    const keys = await connection.run(
      (db) =>
        db
          .select()
          .from(syncObjectDeletions)
          .where(
            and(
              gt(syncObjectDeletions.objectKey, after),
              legacyOnly ? isNull(syncObjectDeletions.projectKey) : undefined,
            ),
          )
          .orderBy(syncObjectDeletions.objectKey)
          .limit(batchSize),
      signal,
    );
    const projects = new Map<string | null, typeof keys>();
    for (const key of keys) {
      const entries = projects.get(key.projectKey) ?? [];
      entries.push(key);
      projects.set(key.projectKey, entries);
    }
    for (const [projectKey, entries] of projects) {
      for (let offset = 0; offset < entries.length; offset += 8) {
        try {
          await connection.run(
            (db) =>
              db.transaction(async (tx) => {
                if (!(await canReclaim(tx, projectKey))) return;
                // One exclusion protects these independent keys until every admitted
                // removal drains. Small groups avoid holding it for an entire page.
                await removePayloads(tx, payloads, entries.slice(offset, offset + 8), signal, legacyOnly);
              }),
            signal,
          );
        } catch (error) {
          signal?.throwIfAborted();
          // Leave failed batches queued and let independent work finish before reporting the failure.
          firstFailure ??= { error };
        }
      }
    }
    if (keys.length < batchSize) break;
    after = keys.at(-1)!.objectKey;
  }
  if (firstFailure) throw firstFailure.error;
};
