import { and, eq, isNull } from "drizzle-orm";
import type { AssetOwner, AssetReference } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { assetTransfers } from "../../db/schemas.pg";

const matches = (owner: AssetOwner, operationId: string) =>
  and(
    eq(assetTransfers.project_id, owner.workbenchId),
    eq(assetTransfers.extension_id, owner.extensionId),
    eq(assetTransfers.operation_id, operationId),
  );

export const createAssetTransfersDBService = (db: DbClient) => {
  const get = async (owner: AssetOwner, operationId: string) => {
    const rows = await db.select().from(assetTransfers).where(matches(owner, operationId));
    return rows[0] ?? null;
  };
  const begin = async (owner: AssetOwner, operationId: string, expected: AssetReference) => {
    await db
      .insert(assetTransfers)
      .values({
        project_id: owner.workbenchId,
        extension_id: owner.extensionId,
        operation_id: operationId,
        expected,
        created_at: new Date().toISOString(),
      })
      .onConflictDoNothing();
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
