import { sql } from "drizzle-orm";
import { lockAccount, projectKey } from "./accounts";
import type { connectRelay } from "./database";

type RelayDb = ReturnType<typeof connectRelay>["db"];

const count = (value: unknown) => Number(value ?? 0);

/**
 * Clears one project of one account from the relay, for an operator, so the project can sync again
 * from nothing. Without `execute` it only reports what is stored.
 *
 * It removes everything through cleanup's own paths, so object storage is emptied too:
 * - Update and state rows are removed and their objects queued for deletion.
 * - Every blob is marked `deleting`. Cleanup removes their objects and rows on its next run.
 * - Documents are removed.
 * - The project record is removed once it has no blobs left, so a run after cleanup finishes the clear.
 *
 * It holds the account's write lock, so no write of this account interleaves with it.
 */
export const clearRelayProject = async (
  db: RelayDb,
  input: { accountId: string; projectId: string; execute: boolean; statementTimeoutMs?: number },
) => {
  const key = projectKey(input.accountId, input.projectId);
  return db.transaction(
    async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${Math.round(input.statementTimeoutMs ?? 300_000)}`));
      await tx.execute(sql`SET LOCAL lock_timeout = 30000`);
      if (input.execute) await lockAccount(tx, input.accountId);
      const stored = await tx.execute<{
        project: boolean;
        documents: string;
        updates: string;
        updateBytes: string;
        states: string;
        stateBytes: string;
        blobs: string;
        blobBytes: string;
        deleting: string;
      }>(sql`
        SELECT
          EXISTS (SELECT 1 FROM relay_sync_projects WHERE "projectKey" = ${key} AND "accountId" = ${input.accountId})
            AS project,
          (SELECT count(*) FROM relay_sync_documents WHERE "projectKey" = ${key}) AS documents,
          (SELECT count(*) FROM relay_sync_updates WHERE "projectKey" = ${key}) AS updates,
          (SELECT coalesce(sum("byteLength"), 0) FROM relay_sync_updates WHERE "projectKey" = ${key}) AS "updateBytes",
          (SELECT count(*) FROM relay_sync_states WHERE "projectKey" = ${key}) AS states,
          (SELECT coalesce(sum("byteLength"), 0) FROM relay_sync_states WHERE "projectKey" = ${key}) AS "stateBytes",
          (SELECT count(*) FROM relay_sync_blobs WHERE "projectKey" = ${key}) AS blobs,
          (SELECT coalesce(sum("byteLength"), 0) FROM relay_sync_blobs WHERE "projectKey" = ${key}) AS "blobBytes",
          (SELECT count(*) FROM relay_sync_blobs WHERE "projectKey" = ${key} AND status = 'deleting') AS deleting`);
      const row = stored.rows[0]!;
      const before = {
        project: row.project,
        documents: count(row.documents),
        updates: { count: count(row.updates), bytes: count(row.updateBytes) },
        states: { count: count(row.states), bytes: count(row.stateBytes) },
        blobs: { count: count(row.blobs), bytes: count(row.blobBytes), deleting: count(row.deleting) },
      };
      const report = { accountId: input.accountId, projectId: input.projectId, projectKey: key, before };
      if (!input.execute || !row.project) return { ...report, executed: false, projectRemoved: false };

      for (const table of ["relay_sync_updates", "relay_sync_states"] as const)
        await tx.execute(sql`
          WITH gone AS (
            DELETE FROM ${sql.identifier(table)} WHERE "projectKey" = ${key} RETURNING "objectKey"
          )
          INSERT INTO relay_sync_object_deletions SELECT "objectKey" FROM gone ON CONFLICT DO NOTHING`);
      await tx.execute(sql`
        UPDATE relay_sync_blobs SET status = 'deleting' WHERE "projectKey" = ${key} AND status <> 'deleting'`);
      await tx.execute(sql`DELETE FROM relay_sync_documents WHERE "projectKey" = ${key}`);
      // Blob rows cascade from the project record, so it stays until cleanup has removed their objects.
      const projectRemoved = before.blobs.count === 0;
      if (projectRemoved) await tx.execute(sql`DELETE FROM relay_sync_projects WHERE "projectKey" = ${key}`);
      return { ...report, executed: true, projectRemoved };
    },
    input.execute ? undefined : { isolationLevel: "repeatable read", accessMode: "read only" },
  );
};
