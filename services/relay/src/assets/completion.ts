import { and, asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fingerprint } from "pstdio-sync-contracts";
import type { createAssetObjects } from "./objects";
import { assetParts, assetUploads, verifiedAssets } from "./schema";

export const completeUpload = async (
  db: NodePgDatabase,
  row: typeof assetUploads.$inferSelect,
  objects: ReturnType<typeof createAssetObjects>,
  signal: AbortSignal,
) => {
  const parts = await db
    .select()
    .from(assetParts)
    .where(and(eq(assetParts.ownerId, row.ownerId), eq(assetParts.uploadId, row.id)))
    .orderBy(asc(assetParts.number));
  const count = Math.ceil(row.asset.byteLength / row.partSize);
  if (parts.length !== count || parts.some((part, index) => part.number !== index + 1 || !part.etag))
    throw new Error("Asset upload has incomplete parts");
  if (!(await objects.head(row.objectKey, undefined, signal))) {
    if (row.asset.byteLength === 0) await objects.empty(row.objectKey, row.asset, signal);
    else {
      if (!row.multipartId) throw new Error("Asset multipart upload is not initialized");
      await objects.finish(
        row.objectKey,
        row.multipartId,
        parts.map((part) => ({ ...part, etag: part.etag! })),
        signal,
      );
    }
  }
  const etag = await objects.verify(row.objectKey, row.asset, signal);
  await db.transaction(async (transaction) => {
    const updated = await transaction
      .update(assetUploads)
      .set({ status: "completed" })
      .where(and(eq(assetUploads.ownerId, row.ownerId), eq(assetUploads.id, row.id), eq(assetUploads.status, "open")))
      .returning();
    if (!updated.length) throw new Error("Asset upload was cancelled");
    await transaction
      .insert(verifiedAssets)
      .values({
        ownerId: row.ownerId,
        reference: await fingerprint(row.asset),
        asset: row.asset,
        objectKey: row.objectKey,
        etag,
      })
      .onConflictDoUpdate({
        target: [verifiedAssets.ownerId, verifiedAssets.reference],
        set: { objectKey: row.objectKey, etag },
      });
  });
  return row.asset;
};
