import { sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { prepareOwnedRowUpgrade } from "./owned-row-upgrade";
import { timestampToIso } from "./schemas/iso-timestamp";

/** Keep transfer identity and cancellation durable while replacing the composite owner key. */
export const prepareAssetOwnerUpgrade = async (db: DbClient, path: string) => {
  const {
    rows: [columns],
  } = await db.execute<{ legacy: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='asset_transfers' AND column_name='project_id') AS legacy`);
  const restore = await prepareOwnedRowUpgrade(db, path, {
    source: {
      table: "asset_transfers",
      name: "asset-transfer-owners",
      archive: "asset-transfers",
      capture: columns!.legacy,
    },
    target: "asset_transfers",
    projectKey: "project_id",
    fields: ["operation_id", "expected", "cancelled_at", "created_at"],
    timestamps: ["cancelled_at", "created_at"],
    conflict: "Asset transfer restoration conflict",
    keys: ["operation_id"],
    normalize: (row) => ({
      ...row,
      created_at: timestampToIso(row.created_at as string),
      cancelled_at: row.cancelled_at === null ? null : timestampToIso(row.cancelled_at as string),
    }),
  });
  // The old table must be empty before generated DDL adds its required owner FK.
  // Its complete, fsynced input survives both schema and restoration interruption.
  if (columns!.legacy) await db.execute(sql`TRUNCATE asset_transfers`);
  if (!restore) return;
  return async () => {
    await restore.resume();
    await restore.complete();
  };
};
