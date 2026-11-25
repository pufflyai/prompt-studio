import { and, eq, isNull } from "drizzle-orm";
import type { AssetOwner, AssetReference } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { assetTransfers } from "../../db/schemas.pg";
import { ensureStorageOwner, storageOwnerKey } from "../extension-storage/storage-owner-key";

const matches = (owner: AssetOwner, operationId: string) =>
  and(eq(assetTransfers.owner_id, storageOwnerKey(owner)), eq(assetTransfers.operation_id, operationId));

export const createAssetTransfersDBService = (db: DbClient) => {
  const get = async (owner: AssetOwner, operationId: string) => {
    const rows = await db.select().from(assetTransfers).where(matches(owner, operationId));
    if (!rows[0]) return null;
    const { owner_id, ...row } = rows[0];
    return { project_id: owner.workbenchId, extension_id: owner.extensionId, ...row };
  };
  const begin = async (owner: AssetOwner, operationId: string, expected: AssetReference) => {
    await db.transaction(async (tx) => {
      const ownerId = await ensureStorageOwner(tx, owner);
      await tx
        .insert(assetTransfers)
        .values({
          owner_id: ownerId,
          operation_id: operationId,
          expected,
          created_at: new Date().toISOString(),
        })
        .onConflictDoNothing();
    });
    return (await get(owner, operationId))!;
  };
  const cancel = async (owner: AssetOwner, operationId: string) => {
    await db
      .update(assetTransfers)
      .set({ cancelled_at: new Date().toISOString() })
      .where(and(matches(owner, operationId), isNull(assetTransfers.cancelled_at)));
    return get(owner, operationId);
  };
  return { begin, get, cancel };
};
