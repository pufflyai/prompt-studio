import { and, eq, sql } from "drizzle-orm";
import type { createRelayAssets } from "../assets/assets";
import { lockAccount } from "./accounts";
import { protectedBlobGraph } from "./blob-graph";
import { blobOwner } from "./blobs";
import type { connectRelay } from "./database";
import { syncBlobs } from "./document-schema";

const batchSize = 500;

// A blob is unused when no stored update or latest state lists it and its last use is older than the
// grace period (R21). Unfinished uploads expire after the grace period too.
const unusedBlob = (cutoff: Date) => sql`(
  (b."status" = 'open' AND b."createdAt" <= ${cutoff})
  OR (b."status" = 'completed' AND coalesce(b."lastUsedAt", b."completedAt") <= ${cutoff}
    AND NOT EXISTS (SELECT 1 FROM protected p
      WHERE p."projectKey" = b."projectKey" AND p."blobId" = b."blobId"))
)`;

const markAccountBlobs = async (
  connection: ReturnType<typeof connectRelay>,
  accountId: string,
  cutoff: Date,
  signal?: AbortSignal,
) => {
  while (true) {
    const marked = await connection.run(
      (db) =>
        db.transaction(async (transaction) => {
          await lockAccount(transaction, accountId);
          return transaction.execute(sql`
          ${protectedBlobGraph(cutoff, accountId)}, candidates AS (
            SELECT b."projectKey", b."blobId" FROM relay_sync_blobs b JOIN owned USING ("projectKey")
            WHERE ${unusedBlob(cutoff)}
              AND NOT EXISTS (SELECT 1 FROM relay_sync_blobs parent
                WHERE parent."projectKey" = b."projectKey" AND parent."status" <> 'deleting'
                  AND parent."children" @> ARRAY[b."blobId"])
            ORDER BY b."projectKey", b."blobId" LIMIT ${batchSize}
          )
          UPDATE relay_sync_blobs b SET "status" = 'deleting' FROM candidates c
          WHERE b."projectKey" = c."projectKey" AND b."blobId" = c."blobId" RETURNING 1`);
        }),
      signal,
    );
    if (!marked.rows.length) break;
  }
};

/** Account-scoped reachability and bounded metadata/object retirement batches. */
export const cleanupBlobGraph = async (
  connection: ReturnType<typeof connectRelay>,
  assets: ReturnType<typeof createRelayAssets>,
  cutoff: Date,
  signal?: AbortSignal,
) => {
  let afterAccount = "";
  while (true) {
    const accounts = await connection.run(
      (db) =>
        db.execute<{ accountId: string }>(sql`
        SELECT DISTINCT p."accountId" FROM relay_sync_projects p
        WHERE p."accountId" > ${afterAccount}
          AND EXISTS (SELECT 1 FROM relay_sync_blobs b WHERE b."projectKey" = p."projectKey"
            AND ((b."status" = 'open' AND b."createdAt" <= ${cutoff})
              OR (b."status" = 'completed' AND coalesce(b."lastUsedAt", b."completedAt") <= ${cutoff})))
        ORDER BY p."accountId" LIMIT ${batchSize}`),
      signal,
    );
    // Retire parents before children so every completed parent always has a complete graph.
    // New references hold this same lock, so they cannot race deletion marking.
    for (const { accountId } of accounts.rows) {
      await markAccountBlobs(connection, accountId, cutoff, signal);
      afterAccount = accountId;
    }
    if (accounts.rows.length < batchSize) break;
  }
  while (true) {
    const deleting = await connection.run(
      (db) => db.select().from(syncBlobs).where(eq(syncBlobs.status, "deleting")).limit(batchSize),
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
    if (deleting.length < batchSize) break;
  }
};
