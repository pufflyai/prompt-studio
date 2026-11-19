import { and, eq, sql } from "drizzle-orm";
import type { ProjectDeletionJob } from "pstdio-sync-contracts";
import type { createRelayAssets } from "../assets/assets";
import { lockAccount, projectKey } from "./accounts";
import { blobOwner } from "./blobs";
import type { connectRelay } from "./database";
import { projectRetirements, syncBlobs, syncObjectDeletions, syncProjects } from "./document-schema";
import { sweepUntrackedLegacyPayloads } from "./legacy-payloads";
import { cleanupPayloads } from "./payload-cleanup";
import type { PayloadObjects } from "./payloads";
import { projectAdvisoryKey } from "./project-access";
import { projectRetiredChannel } from "./project-notices";

type Connection = ReturnType<typeof connectRelay>;
const batchSize = 200;

const purgeDocumentRows = async (connection: Connection, key: string, signal: AbortSignal) => {
  for (const table of ["relay_sync_updates", "relay_sync_states"]) {
    while (true) {
      const deleted = await connection.run(
        (db) =>
          db.execute<{ seen: number }>(sql`
        WITH batch AS MATERIALIZED (
          SELECT ctid FROM ${sql.identifier(table)} WHERE "projectKey" = ${key} LIMIT ${batchSize}
        ), gone AS (
          DELETE FROM ${sql.identifier(table)} WHERE ctid IN (SELECT ctid FROM batch) RETURNING "objectKey"
        ), queued AS (
          INSERT INTO relay_sync_object_deletions ("objectKey", "projectKey")
            SELECT "objectKey", ${key} FROM gone
            ON CONFLICT ("objectKey") DO UPDATE SET "projectKey" = excluded."projectKey"
        )
        SELECT count(*)::int AS seen FROM batch`),
        signal,
      );
      if (deleted.rows[0]!.seen < batchSize) break;
    }
  }
};

const purgePayloads = async (connection: Connection, payloads: PayloadObjects, key: string, signal: AbortSignal) => {
  while (true) {
    const rows = await connection.run(
      (db) => db.select().from(syncObjectDeletions).where(eq(syncObjectDeletions.projectKey, key)).limit(batchSize),
      signal,
    );
    for (const { objectKey, multipartId } of rows) {
      await payloads.discard(objectKey, multipartId, signal);
      await payloads.remove(objectKey, signal);
      await payloads.verifyRemoved(objectKey, signal);
      await connection.run(
        (db) => db.delete(syncObjectDeletions).where(eq(syncObjectDeletions.objectKey, objectKey)),
        signal,
      );
    }
    if (rows.length < batchSize) return;
  }
};

const purgeBlobs = async (
  connection: Connection,
  assets: ReturnType<typeof createRelayAssets>,
  key: string,
  signal: AbortSignal,
) => {
  while (true) {
    const blobs = await connection.run(
      (db) => db.select().from(syncBlobs).where(eq(syncBlobs.projectKey, key)).limit(batchSize),
      signal,
    );
    for (const blob of blobs) {
      // The asset owner's distributed writer lock drains multipart work and verifies that
      // no upload survived abort. Keep the blob address until that cleanup is durable.
      await assets.remove(blobOwner(blob), blob.blobId, signal);
      await connection.run(
        (db) => db.delete(syncBlobs).where(and(eq(syncBlobs.projectKey, key), eq(syncBlobs.blobId, blob.blobId))),
        signal,
      );
    }
    if (blobs.length < batchSize) return;
  }
};

interface DeletionOwners {
  connection: Connection;
  control: Connection;
  payloads: PayloadObjects;
  assets: ReturnType<typeof createRelayAssets>;
}

export const createProjectDeletion =
  ({ connection, control, payloads, assets }: DeletionOwners) =>
  async (job: ProjectDeletionJob, signal: AbortSignal) => {
    const key = projectKey(job.accountId, job.workbenchId);
    const operation = await control.run(
      (db) =>
        db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${projectAdvisoryKey(key)})`);
          await lockAccount(tx, job.accountId);
          await tx
            .insert(projectRetirements)
            .values({ projectKey: key, operationId: job.operationId })
            .onConflictDoNothing();
          const [row] = await tx.select().from(projectRetirements).where(eq(projectRetirements.projectKey, key));
          if (row?.operationId !== job.operationId)
            throw new Error("Cloud retirement operation has a different identity");
          await tx.execute(sql`SELECT pg_notify(${projectRetiredChannel}, ${key})`);
          return row;
        }),
      signal,
    );
    if (operation.completedAt) return;

    // The barrier commits before any external delete. A crash leaves the scope closed
    // and its remaining work in the object queue and blob ownership rows.
    await control.run(
      (db) =>
        db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`relay-project-purge:${key}`}, 0))`);
          const [row] = await tx.select().from(projectRetirements).where(eq(projectRetirements.projectKey, key));
          if (row?.completedAt) return;
          await sweepUntrackedLegacyPayloads(connection, payloads, signal);
          await purgeDocumentRows(connection, key, signal);
          // Older clear operations could queue keys after dropping the only lookup for
          // their project. Drain only those old, unowned keys after checking for live references.
          await cleanupPayloads(connection, payloads, signal, true);
          await purgePayloads(connection, payloads, key, signal);
          await purgeBlobs(connection, assets, key, signal);
          await tx
            .delete(syncProjects)
            .where(and(eq(syncProjects.projectKey, key), eq(syncProjects.accountId, job.accountId)));
          await tx
            .update(projectRetirements)
            .set({ completedAt: sql`clock_timestamp()` })
            .where(eq(projectRetirements.projectKey, key));
        }),
      signal,
    );
  };
