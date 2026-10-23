import { and, eq, inArray, sql } from "drizzle-orm";
import { ownerManifestFanout, syncIdSchema } from "pstdio-sync-contracts";
import { rejection, SyncRejection } from "./accounts";
import type { BlobAddress } from "./blobs";
import type { RelayTransaction } from "./database";
import { syncBlobs } from "./document-schema";

/** The account lock makes completed-child checks and parent publication indivisible with cleanup. */
export const requireBlobChildren = async (transaction: RelayTransaction, address: BlobAddress, children: string[]) => {
  if (
    children.length > ownerManifestFanout ||
    new Set(children).size !== children.length ||
    children.some((id) => !syncIdSchema.safeParse(id).success || id === address.blobId)
  )
    throw rejection(400, "invalid-request");
  if (!children.length) return;
  const rows = await transaction
    .select({ id: syncBlobs.blobId, spaceOwner: syncBlobs.spaceOwner })
    .from(syncBlobs)
    .where(
      and(
        eq(syncBlobs.projectKey, address.projectKey),
        eq(syncBlobs.status, "completed"),
        inArray(syncBlobs.blobId, children),
      ),
    );
  const present = new Set(rows.filter((row) => row.spaceOwner === address.spaceOwner).map((row) => row.id));
  const missing = children.filter((id) => !present.has(id));
  if (missing.length) throw new SyncRejection(409, { error: "missing-blobs", blobIds: missing });
};

/** Retained roots and uploads inside their existing grace protect the complete immutable DAG. */
export const protectedBlobGraph = (cutoff: Date) => sql`
  WITH RECURSIVE protected("projectKey", "blobId") AS (
    SELECT "projectKey", unnest("blobIds") FROM relay_sync_updates
    UNION
    SELECT "projectKey", unnest("blobIds") FROM relay_sync_states
    UNION
    SELECT "projectKey", "blobId" FROM relay_sync_blobs
      WHERE ("status" = 'open' AND "createdAt" > ${cutoff})
        OR ("status" = 'completed' AND coalesce("lastUsedAt", "completedAt") > ${cutoff})
    UNION
    SELECT b."projectKey", unnest(b."children") FROM relay_sync_blobs b
      JOIN protected p ON p."projectKey" = b."projectKey" AND p."blobId" = b."blobId"
  )`;
