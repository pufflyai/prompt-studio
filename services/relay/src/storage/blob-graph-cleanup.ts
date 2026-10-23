import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { createRelayAssets } from "../assets/assets";
import { lockAccount } from "./accounts";
import { blobRetirementPage } from "./blob-retirement";
import { blobOwner } from "./blobs";
import type { connectRelay } from "./database";
import { syncBlobs, syncProjects } from "./document-schema";

const batchSize = 500;

const markProjectBlobs = async (
  connection: ReturnType<typeof connectRelay>,
  accountId: string,
  projectKey: string,
  cutoff: Date,
  signal?: AbortSignal,
) => {
  while (true) {
    let progress = 0;
    let after = { projectKey, blobId: "" };
    while (true) {
      const page = await connection.run(
        (db) =>
          db.transaction(async (transaction) => {
            await lockAccount(transaction, accountId);
            const page = await transaction.execute<{ projectKey: string; blobId: string; retire: boolean }>(
              blobRetirementPage(accountId, cutoff, after),
            );
            const ids = page.rows.filter((row) => row.retire).map((row) => row.blobId);
            if (ids.length)
              await transaction
                .update(syncBlobs)
                .set({ status: "deleting" })
                .where(and(eq(syncBlobs.projectKey, projectKey), inArray(syncBlobs.blobId, ids)));
            return page.rows;
          }),
        signal,
      );
      progress += page.filter((row) => row.retire).length;
      if (page.length < batchSize) break;
      after = page.at(-1)!;
    }
    // Children sorting before their retired parent become eligible on the next pass.
    // No new grace period or stale reachability cache is introduced between pages.
    if (!progress) break;
  }
};

const markAccountBlobs = async (
  connection: ReturnType<typeof connectRelay>,
  accountId: string,
  cutoff: Date,
  signal?: AbortSignal,
) => {
  let afterProject = "";
  while (true) {
    const projects = await connection.run(
      (db) =>
        db
          .select({ projectKey: syncProjects.projectKey })
          .from(syncProjects)
          .where(and(eq(syncProjects.accountId, accountId), gt(syncProjects.projectKey, afterProject)))
          .orderBy(syncProjects.projectKey)
          .limit(batchSize),
      signal,
    );
    for (const { projectKey } of projects) {
      await markProjectBlobs(connection, accountId, projectKey, cutoff, signal);
      afterProject = projectKey;
    }
    if (projects.length < batchSize) return;
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
