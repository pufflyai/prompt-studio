import { and, eq, inArray, sql } from "drizzle-orm";
import type { SyncError } from "pstdio-sync-contracts/protocol";
import type { RelayDatabase, RelayTransaction } from "./database";
import { syncBlobs, syncProjects } from "./document-schema";

/** A request the relay refuses. The transport returns its status and body unchanged. */
export class SyncRejection extends Error {
  constructor(
    readonly status: number,
    readonly body: SyncError,
  ) {
    super(body.error);
  }
}

export const rejection = (status: number, error: Extract<SyncError, { error: string }>["error"]) =>
  new SyncRejection(status, { error } as SyncError);

/** The authenticated device behind a request. */
export interface SyncCaller {
  accountId: string;
  deviceId: string;
}

const requireOwner = (project: { accountId: string } | undefined, accountId: string) => {
  if (project && project.accountId !== accountId) throw rejection(403, "forbidden");
};

export const checkProject = async (db: RelayDatabase | RelayTransaction, projectId: string, accountId: string) => {
  const [project] = await db.select().from(syncProjects).where(eq(syncProjects.projectId, projectId));
  requireOwner(project, accountId);
  return project;
};

export const lockAccount = (transaction: RelayTransaction, accountId: string) =>
  transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`relay-account:${accountId}`}, 0))`);

/**
 * Serializes writes per account, so quota checks and blob cleanup see a consistent set of rows.
 * The first write binds the project to the caller's account.
 */
export const admitWrite = async (transaction: RelayTransaction, projectId: string, accountId: string, now: Date) => {
  await lockAccount(transaction, accountId);
  await transaction.insert(syncProjects).values({ projectId, accountId, createdAt: now }).onConflictDoNothing();
  await checkProject(transaction, projectId, accountId);
};

export const requireQuota = async (transaction: RelayTransaction, accountId: string, bytes: number, quota: number) => {
  const result = await transaction.execute<{ used: string }>(sql`
    SELECT (
      (SELECT coalesce(sum(u."byteLength"), 0) FROM relay_sync_updates u
        JOIN relay_sync_projects p ON p."projectId" = u."projectId" WHERE p."accountId" = ${accountId})
      + (SELECT coalesce(sum(s."byteLength"), 0) FROM relay_sync_states s
        JOIN relay_sync_projects p ON p."projectId" = s."projectId" WHERE p."accountId" = ${accountId})
      + (SELECT coalesce(sum(b."byteLength"), 0) FROM relay_sync_blobs b
        JOIN relay_sync_projects p ON p."projectId" = b."projectId" WHERE p."accountId" = ${accountId})
    )::text AS used`);
  if (Number(result.rows[0]!.used) + bytes > quota) throw rejection(507, "quota-exceeded");
};

/** A client uploads every blob completely before an update or latest state may use it (R21). */
export const requireBlobs = async (transaction: RelayTransaction, projectId: string, blobIds: string[]) => {
  if (!blobIds.length) return;
  const rows = await transaction
    .select({ blobId: syncBlobs.blobId })
    .from(syncBlobs)
    .where(
      and(eq(syncBlobs.projectId, projectId), eq(syncBlobs.status, "completed"), inArray(syncBlobs.blobId, blobIds)),
    );
  const present = new Set(rows.map((row) => row.blobId));
  const missing = blobIds.filter((id) => !present.has(id));
  if (missing.length) throw new SyncRejection(409, { error: "missing-blobs", blobIds: missing });
};
