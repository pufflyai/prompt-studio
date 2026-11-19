import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { reservationKey, reservationLock } from "./object-reservations";
import type { createAssetObjects } from "./objects";
import { assetUploads } from "./schema";

export const reserveBlobUpload = async (
  db: NodePgDatabase,
  row: typeof assetUploads.$inferSelect,
  objects: ReturnType<typeof createAssetObjects>,
  signal: AbortSignal,
) => {
  const upload = and(
    eq(assetUploads.ownerId, row.ownerId),
    eq(assetUploads.id, row.id),
    eq(assetUploads.status, "open"),
  );
  // A previous relay can have started a reservation on the original asset key.
  const recovered = row.objectKey ? await objects.recover(row.objectKey, signal) : undefined;
  if (recovered) {
    await db.update(assetUploads).set({ multipartId: recovered }).where(upload);
    return;
  }
  const objectKey = reservationKey();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${reservationLock(objectKey)})`);
    const multipartId = await objects.initiate(objectKey, row.asset.mediaType, signal);
    const claimed = await tx
      .update(assetUploads)
      .set({ objectKey, multipartId, legacyObjectKey: row.objectKey || null })
      .where(upload)
      .returning();
    if (!claimed.length) throw new Error("Asset upload was cancelled");
  });
};
