import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { connectRelay, RelayTransaction } from "./database";
import { projectRetirements, syncObjectDeletions } from "./document-schema";
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

export const cleanupPayloads = async (
  connection: ReturnType<typeof connectRelay>,
  payloads: PayloadObjects,
  signal?: AbortSignal,
  legacyOnly = false,
) => {
  let after = "";
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
    for (const { objectKey, projectKey, multipartId } of keys) {
      await connection.run(
        (db) =>
          db.transaction(async (tx) => {
            if (!(await canReclaim(tx, projectKey))) return;
            const present = await tx.execute<{ referenced: boolean }>(sql`
          SELECT EXISTS (SELECT 1 FROM relay_sync_updates WHERE "objectKey" = ${objectKey})
            OR EXISTS (SELECT 1 FROM relay_sync_states WHERE "objectKey" = ${objectKey}) AS referenced`);
            if (!present.rows[0]!.referenced) {
              await payloads.discard(objectKey, multipartId, signal);
              await payloads.remove(objectKey, signal);
              if (legacyOnly) await payloads.verifyRemoved(objectKey, signal);
            }
            await tx.delete(syncObjectDeletions).where(eq(syncObjectDeletions.objectKey, objectKey));
          }),
        signal,
      );
    }
    if (keys.length < batchSize) return;
    after = keys.at(-1)!.objectKey;
  }
};
