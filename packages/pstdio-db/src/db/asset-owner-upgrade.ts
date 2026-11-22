import { isDeepStrictEqual } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { timestampToIso } from "./schemas/iso-timestamp";
import { assetTransfers } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type ReleasedTransfer = Omit<typeof assetTransfers.$inferSelect, "owner_id"> & {
  project_id: string;
  extension_id: string;
};

/** Keep transfer identity and cancellation durable while replacing the composite owner key. */
export const prepareAssetOwnerUpgrade = async (db: DbClient, path: string) => {
  const {
    rows: [columns],
  } = await db.execute<{ legacy: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='asset_transfers' AND column_name='project_id') AS legacy`);
  const pending: ReleasedTransfer[] = [];
  let pendingBytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    pendingBytes = 0;
    await db.transaction(async (tx) => {
      for (const { project_id, extension_id, ...fields } of batch) {
        const ownerId = await ensureStorageOwner(tx, { workbenchId: project_id, extensionId: extension_id });
        const expected = {
          ...fields,
          created_at: timestampToIso(fields.created_at),
          cancelled_at: fields.cancelled_at === null ? null : timestampToIso(fields.cancelled_at),
          owner_id: ownerId,
        };
        const [existing] = await tx
          .select()
          .from(assetTransfers)
          .where(and(eq(assetTransfers.owner_id, ownerId), eq(assetTransfers.operation_id, fields.operation_id)));
        if (existing) {
          if (!isDeepStrictEqual(existing, expected)) throw new Error("Asset transfer restoration conflict");
        } else await tx.insert(assetTransfers).values(expected);
      }
    });
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "asset_transfers",
      keys: ["project_id", "extension_id", "operation_id"],
      name: "asset-transfer-owners",
      archive: "asset-transfers",
      capture: columns!.legacy,
    },
    async (input) => {
      const bytes = Buffer.byteLength(JSON.stringify(input));
      if (pending.length && pendingBytes + bytes > 4 * 1024 * 1024) await flush();
      pending.push(input as ReleasedTransfer);
      pendingBytes += bytes;
      if (pending.length === 200) await flush();
    },
  );
  // The old table must be empty before generated DDL adds its required owner FK.
  // Its complete, fsynced input survives both schema and restoration interruption.
  if (columns!.legacy) await db.delete(assetTransfers);
  if (!restore) return;
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
