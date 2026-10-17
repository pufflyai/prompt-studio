import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { assetSchema } from "pstdio-sync-contracts";
import type { createAssetObjects } from "./objects";
import { assetParts, type assetUploads } from "./schema";
import type { PartInput } from "./streams";

export const writeUploadPart = async (
  db: NodePgDatabase,
  row: typeof assetUploads.$inferSelect,
  number: number,
  input: PartInput,
  objects: ReturnType<typeof createAssetObjects>,
  signal: AbortSignal,
) => {
  if (row.status !== "open") throw new Error("Asset upload is already completed");
  const expected = Math.min(row.partSize, row.asset.byteLength - (number - 1) * row.partSize);
  if (!Number.isInteger(number) || number < 1 || expected <= 0 || input.byteLength !== expected)
    throw new Error("Invalid asset part range");
  assetSchema.shape.sha256.parse(input.sha256);
  const where = and(
    eq(assetParts.ownerId, row.ownerId),
    eq(assetParts.uploadId, row.id),
    eq(assetParts.number, number),
  );
  await db
    .insert(assetParts)
    .values({
      ownerId: row.ownerId,
      uploadId: row.id,
      number,
      sha256: input.sha256,
      byteLength: input.byteLength,
    })
    .onConflictDoNothing();
  const part = (await db.select().from(assetParts).where(where))[0];
  if (part.sha256 !== input.sha256 || part.byteLength !== input.byteLength)
    throw new Error("Part identity reused with changed bytes");
  if (part.etag) return;
  if (!row.multipartId) throw new Error("Asset multipart upload is not initialized");
  const etag = await objects.write(row.objectKey, row.multipartId, number, input, signal);
  await db.update(assetParts).set({ etag }).where(where);
};
