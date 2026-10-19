import { and, eq, ne } from "drizzle-orm";
import type { BlobBegin } from "pstdio-sync-contracts/protocol";
import type { createRelayAssets } from "../assets/assets";
import type { PartInput } from "../assets/streams";
import type { RelayLimits } from "../limits";
import { admitWrite, checkProject, rejection, requireQuota, type SyncCaller } from "./accounts";
import type { connectRelay } from "./database";
import { syncBlobs } from "./document-schema";

/** One encrypted blob. Its ID is random; a null space owner marks the project's shared space. */
export interface BlobAddress {
  projectId: string;
  spaceOwner: string | null;
  blobId: string;
}

export const blobOwner = ({ projectId, blobId }: { projectId: string; blobId: string }) => ({ projectId, blobId });
export const blobAsset = (blob: { sha256: string; byteLength: number }) => ({
  sha256: blob.sha256,
  byteLength: blob.byteLength,
  // Ciphertext has no meaningful media type, and the real one would reveal content.
  mediaType: "application/octet-stream",
});

/** Encrypted files. Uploads resume part by part through the verified asset owner (R25). */
export const createSyncBlobs = (
  connection: ReturnType<typeof connectRelay>,
  assets: ReturnType<typeof createRelayAssets>,
  limits: RelayLimits,
) => {
  const find = (address: BlobAddress, caller: SyncCaller, signal?: AbortSignal) =>
    connection.run(async (db) => {
      await checkProject(db, address.projectId, caller.accountId);
      const [blob] = await db
        .select()
        .from(syncBlobs)
        .where(
          and(
            eq(syncBlobs.projectId, address.projectId),
            eq(syncBlobs.blobId, address.blobId),
            ne(syncBlobs.status, "deleting"),
          ),
        );
      if (!blob || blob.spaceOwner !== address.spaceOwner) throw rejection(404, "not-found");
      return blob;
    }, signal);

  return {
    async begin(address: BlobAddress, caller: SyncCaller, input: BlobBegin, signal?: AbortSignal) {
      if (input.byteLength > limits.maxBlobBytes) throw rejection(413, "too-large");
      const now = new Date();
      await connection.run(
        (db) =>
          db.transaction(async (transaction) => {
            await admitWrite(transaction, address.projectId, caller.accountId, now);
            const created = await transaction
              .insert(syncBlobs)
              .values({
                projectId: address.projectId,
                blobId: address.blobId,
                spaceOwner: address.spaceOwner,
                sha256: input.sha256,
                byteLength: input.byteLength,
                status: "open",
                createdAt: now,
              })
              .onConflictDoNothing()
              .returning();
            if (created.length) await requireQuota(transaction, caller.accountId, 0, limits.accountQuotaBytes);
          }),
        signal,
      );
      const blob = await find(address, caller, signal);
      if (blob.sha256 !== input.sha256 || blob.byteLength !== input.byteLength) throw rejection(400, "invalid-request");
      const status = await assets.begin(blobOwner(address), address.blobId, blobAsset(blob));
      return {
        partSize: status.partSize,
        completed: status.completed,
        parts: status.parts
          .filter((part) => part.etag !== null)
          .map(({ number, sha256, byteLength }) => ({ number, sha256, byteLength })),
      };
    },
    async writePart(address: BlobAddress, caller: SyncCaller, number: number, input: PartInput) {
      await find(address, caller, input.signal);
      await assets.writePart(blobOwner(address), address.blobId, number, input);
    },
    async finish(address: BlobAddress, caller: SyncCaller, signal?: AbortSignal) {
      await find(address, caller, signal);
      await assets.finish(blobOwner(address), address.blobId);
      await connection.run(
        (db) =>
          db
            .update(syncBlobs)
            .set({ status: "completed", completedAt: new Date() })
            .where(
              and(
                eq(syncBlobs.projectId, address.projectId),
                eq(syncBlobs.blobId, address.blobId),
                eq(syncBlobs.status, "open"),
              ),
            ),
        signal,
      );
    },
    async read(address: BlobAddress, caller: SyncCaller, offset: number, signal?: AbortSignal) {
      const blob = await find(address, caller, signal);
      if (blob.status !== "completed") throw rejection(404, "not-found");
      if (offset > blob.byteLength) throw rejection(400, "invalid-request");
      const result = await assets.read(blobOwner(address), blobAsset(blob), offset, signal);
      if (!result) throw rejection(404, "not-found");
      return { byteLength: blob.byteLength, body: result.body };
    },
  };
};
