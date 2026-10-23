import { and, eq, ne } from "drizzle-orm";
import type { BlobBegin } from "pstdio-sync-contracts";
import type { createRelayAssets } from "../assets/assets";
import { multipartSize, type PartInput } from "../assets/streams";
import type { RelayLimits } from "../limits";
import { admitWrite, lockAccount, rejection, requireQuota, type SyncCaller } from "./accounts";
import { requireBlobChildren } from "./blob-graph";
import type { connectRelay } from "./database";
import { syncBlobs, syncProjects } from "./document-schema";

/** One encrypted blob. Its ID is random; a null space owner marks the project's shared space. */
export interface BlobAddress {
  projectKey: string;
  spaceOwner: string | null;
  blobId: string;
}

export const blobOwner = ({ projectKey, blobId }: { projectKey: string; blobId: string }) => ({ projectKey, blobId });
export const blobAsset = (blob: { sha256: string; byteLength: number }) => ({
  sha256: blob.sha256,
  byteLength: blob.byteLength,
  // Ciphertext has no meaningful media type, and the real one would reveal content.
  mediaType: "application/octet-stream",
});

const blobWhere = (address: BlobAddress) =>
  and(eq(syncBlobs.projectKey, address.projectKey), eq(syncBlobs.blobId, address.blobId));

/** Encrypted files. Uploads resume part by part through the verified asset owner (R25). */
export const createSyncBlobs = (
  connection: ReturnType<typeof connectRelay>,
  assets: ReturnType<typeof createRelayAssets>,
  limits: RelayLimits,
) => {
  const find = (address: BlobAddress, signal?: AbortSignal) =>
    connection.run(async (db) => {
      const [blob] = await db
        .select()
        .from(syncBlobs)
        .where(and(blobWhere(address), ne(syncBlobs.status, "deleting")));
      if (!blob || blob.spaceOwner !== address.spaceOwner) throw rejection(404, "not-found");
      return blob;
    }, signal);
  const uploadStatus = async (address: BlobAddress, blob: typeof syncBlobs.$inferSelect) => {
    const status = await assets.begin(blobOwner(address), address.blobId, blobAsset(blob));
    return {
      partSize: status.partSize,
      completed: status.completed,
      parts: status.parts
        .filter((part) => part.etag !== null)
        .map(({ number, sha256, byteLength }) => ({ number, sha256, byteLength })),
    };
  };

  const begin = async (
    address: BlobAddress,
    caller: SyncCaller,
    input: BlobBegin,
    children: string[],
    signal?: AbortSignal,
  ) => {
    if (input.byteLength > limits.maxBlobBytes) throw rejection(413, "too-large");
    const now = new Date();
    await connection.run(
      (db) =>
        db.transaction(async (transaction) => {
          await admitWrite(transaction, address.projectKey, caller.accountId, now);
          await requireBlobChildren(transaction, address, children);
          const created = await transaction
            .insert(syncBlobs)
            .values({ ...address, ...input, children, status: "open", createdAt: now })
            .onConflictDoNothing()
            .returning();
          if (created.length) await requireQuota(transaction, caller.accountId, 0, limits.accountQuotaBytes);
          const [stored] = created.length
            ? created
            : await transaction.select().from(syncBlobs).where(blobWhere(address));
          if (!stored || stored.spaceOwner !== address.spaceOwner) throw rejection(404, "not-found");
          if (
            stored.status === "deleting" ||
            stored.sha256 !== input.sha256 ||
            stored.byteLength !== input.byteLength ||
            stored.children.length !== children.length ||
            stored.children.some((id, index) => id !== children[index])
          )
            throw rejection(400, "invalid-request");
        }),
      signal,
    );
    return uploadStatus(address, await find(address, signal));
  };

  return {
    begin: (address: BlobAddress, caller: SyncCaller, input: BlobBegin, signal?: AbortSignal) =>
      begin(address, caller, input, [], signal),
    // Internal until protocol capability negotiation is wired. Protocol-1 begin remains leaf-only.
    beginManifest: (
      address: BlobAddress,
      caller: SyncCaller,
      input: BlobBegin & { children: string[] },
      signal?: AbortSignal,
    ) => begin(address, caller, input, input.children, signal),
    async writePart(address: BlobAddress, number: number, input: PartInput) {
      const blob = await find(address, input.signal);
      // A part sent again after the upload finished is already stored.
      if (blob.status === "completed") return;
      const partSize = multipartSize(blob.byteLength);
      if (input.byteLength !== Math.min(partSize, blob.byteLength - (number - 1) * partSize))
        throw rejection(400, "invalid-request");
      // A stored part is immutable. The same bytes are already there; different bytes are a client error.
      const stored = (await uploadStatus(address, blob)).parts.find((part) => part.number === number);
      if (stored && stored.sha256 !== input.sha256) throw rejection(400, "invalid-request");
      if (stored) return;
      await assets.writePart(blobOwner(address), address.blobId, number, input);
    },
    async finish(address: BlobAddress, signal?: AbortSignal) {
      const blob = await find(address, signal);
      if (blob.status === "completed") return;
      const status = await uploadStatus(address, blob);
      if (status.parts.length !== Math.ceil(blob.byteLength / status.partSize)) throw rejection(400, "invalid-request");
      await assets.finish(blobOwner(address), address.blobId);
      const completed = await connection.run(
        (db) =>
          db.transaction(async (transaction) => {
            const [project] = await transaction
              .select()
              .from(syncProjects)
              .where(eq(syncProjects.projectKey, address.projectKey));
            if (!project) throw rejection(404, "not-found");
            await lockAccount(transaction, project.accountId);
            await requireBlobChildren(transaction, address, blob.children);
            return transaction
              .update(syncBlobs)
              .set({ status: "completed", completedAt: new Date() })
              .where(and(blobWhere(address), eq(syncBlobs.status, "open")))
              .returning();
          }),
        signal,
      );
      // Another request finished it first, or cleanup removed the unfinished upload after its grace period.
      if (!completed.length && (await find(address, signal)).status !== "completed") throw rejection(404, "not-found");
    },
    async read(address: BlobAddress, offset: number, signal?: AbortSignal) {
      const blob = await find(address, signal);
      if (blob.status !== "completed") throw rejection(404, "not-found");
      if (offset > blob.byteLength) throw rejection(400, "invalid-request");
      const result = await assets.read(blobOwner(address), blobAsset(blob), offset, signal);
      if (!result) throw rejection(404, "not-found");
      return { byteLength: blob.byteLength, body: result.body };
    },
  };
};
