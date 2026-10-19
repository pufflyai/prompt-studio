import { and, eq, sql } from "drizzle-orm";
import type { SyncError } from "pstdio-sync-contracts/protocol";
import type { RelayTransaction } from "./database";
import { syncBlobs, syncObjectDeletions, syncProjects } from "./document-schema";

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

/** The authenticated device behind a write. */
export interface SyncCaller {
  accountId: string;
  deviceId: string;
}

/** Project IDs are unique only within one account, so the relay keys every project by both. */
export const projectKey = (accountId: string, projectId: string) =>
  new Bun.CryptoHasher("sha256").update(`${accountId}\n${projectId}`).digest("hex");

export const lockAccount = (transaction: RelayTransaction, accountId: string) =>
  transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`relay-account:${accountId}`}, 0))`);

/**
 * Serializes writes per account, so quota checks and blob cleanup see a consistent set of rows.
 * The first write records which account's quota the project uses.
 */
export const admitWrite = async (transaction: RelayTransaction, key: string, accountId: string, now: Date) => {
  await lockAccount(transaction, accountId);
  await transaction.insert(syncProjects).values({ projectKey: key, accountId, createdAt: now }).onConflictDoNothing();
};

export const requireQuota = async (transaction: RelayTransaction, accountId: string, bytes: number, quota: number) => {
  const result = await transaction.execute<{ used: string }>(sql`
    SELECT (
      (SELECT coalesce(sum(u."byteLength"), 0) FROM relay_sync_updates u
        JOIN relay_sync_projects p ON p."projectKey" = u."projectKey" WHERE p."accountId" = ${accountId})
      + (SELECT coalesce(sum(s."byteLength"), 0) FROM relay_sync_states s
        JOIN relay_sync_projects p ON p."projectKey" = s."projectKey" WHERE p."accountId" = ${accountId})
      + (SELECT coalesce(sum(b."byteLength"), 0) FROM relay_sync_blobs b
        JOIN relay_sync_projects p ON p."projectKey" = b."projectKey" WHERE p."accountId" = ${accountId})
    )::text AS used`);
  if (Number(result.rows[0]!.used) + bytes > quota) throw rejection(507, "quota-exceeded");
};

const blobIn = (blobIds: string[]) => sql`${syncBlobs.blobId} = ANY(${sql.param(blobIds)}::text[])`;

/** A client uploads every blob completely before an update or latest state may use it (R21). */
export const requireBlobs = async (transaction: RelayTransaction, key: string, blobIds: string[]) => {
  if (!blobIds.length) return;
  const rows = await transaction
    .select({ blobId: syncBlobs.blobId })
    .from(syncBlobs)
    .where(and(eq(syncBlobs.projectKey, key), eq(syncBlobs.status, "completed"), blobIn(blobIds)));
  const present = new Set(rows.map((row) => row.blobId));
  const missing = blobIds.filter((id) => !present.has(id));
  if (missing.length) throw new SyncRejection(409, { error: "missing-blobs", blobIds: missing });
};

/**
 * Queues the bytes of removed update and state rows for deletion. The blobs they listed start their
 * grace period now, so a blob stays at least that long after its last use (R21).
 */
export const releaseRows = async (
  transaction: RelayTransaction,
  key: string,
  rows: { objectKey: string; blobIds: string[] }[],
  now: Date,
) => {
  if (!rows.length) return;
  await transaction
    .insert(syncObjectDeletions)
    .values(rows.map(({ objectKey }) => ({ objectKey })))
    .onConflictDoNothing();
  const blobIds = [...new Set(rows.flatMap((row) => row.blobIds))];
  if (blobIds.length)
    await transaction
      .update(syncBlobs)
      .set({ lastUsedAt: now })
      .where(and(eq(syncBlobs.projectKey, key), blobIn(blobIds)));
};
