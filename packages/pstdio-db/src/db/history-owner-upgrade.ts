import { isDeepStrictEqual } from "node:util";
import { eq, sql } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { prepareOwnedRowUpgrade } from "./owned-row-upgrade";
import { owners } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Address = { workbench_id: string; extension_id: string };
type LegacyPosition = Address & { cursor: string | null; migrated: boolean };
const ownerOf = (row: Address) => ({ workbenchId: row.workbench_id, extensionId: row.extension_id });
const same = (actual: unknown, expected: unknown) => {
  if (!isDeepStrictEqual(actual, expected)) throw new Error("Private history restoration conflict");
};

/** Preserve device history across the DDL. The 0.48 local-only cutoff retires relay contributions. */
export const prepareHistoryOwnerUpgrade = async (db: DbClient, path: string, localOnly = false) => {
  // After DDL commits the released prefix has advanced. The durable schema marker
  // still owns the local cutoff until the interrupted restore and cleanup finish.
  const cutoff =
    localOnly ||
    (
      await db.execute<{ pending: boolean }>(
        sql`SELECT to_regnamespace('pstdio_local_upgrade_049') IS NOT NULL AS pending`,
      )
    ).rows[0]?.pending === true;
  const restoreRows = await prepareOwnedRowUpgrade(db, path, {
    source: {
      table: "storage_personal_history",
      name: "history-row-owners",
      archive: "history-rows",
    },
    target: "history_rows",
    projectKey: "workbench_id",
    conflict: "Private history restoration conflict",
    keys: ["kind", "device_id", "record_id"],
    fields: ["device_id", "kind", "record_id", "value", "seed_id", ...(cutoff ? [] : ["pending_id"])],
    normalize: cutoff ? (row) => ({ ...row, pending_id: null }) : undefined,
  });
  const restoreSources = localOnly
    ? undefined
    : await prepareOwnedRowUpgrade(db, path, {
        source: {
          table: "storage_personal_history_sources",
          name: "history-source-owners",
          archive: "history-sources",
        },
        target: "history_sources",
        projectKey: "workbench_id",
        conflict: "Private history restoration conflict",
        keys: ["source_id", "kind", "device_id", "record_id"],
        fields: [
          "source_id",
          "kind",
          "device_id",
          "record_id",
          "value",
          "seed_id",
          "entry_id",
          "sequence",
          "entry_index",
        ],
      });
  const restorePositions = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_personal_history_positions",
      keys: ["workbench_id", "extension_id"],
      name: "history-owner-positions",
      archive: "history-positions",
    },
    async (input) => {
      const row = input as LegacyPosition;
      await db.transaction(async (tx) => {
        const ownerId = await ensureStorageOwner(tx, ownerOf(row));
        const [existing] = await tx
          .select({ cursor: owners.history_cursor, migrated: owners.history_migrated })
          .from(owners)
          .where(eq(owners.id, ownerId));
        if (existing!.cursor !== null || existing!.migrated)
          same(existing, { cursor: row.cursor, migrated: row.migrated });
        await tx
          .update(owners)
          .set({ history_cursor: row.cursor, history_migrated: row.migrated })
          .where(eq(owners.id, ownerId));
      });
    },
  );
  if (!restoreRows && !restoreSources && !restorePositions) return;
  return async () => {
    // An older build can leave restored receipts beside its retained snapshot.
    // Normalize those rows before comparing them with the device-only history.
    if (cutoff && restoreRows)
      await db.execute(sql`UPDATE history_rows SET pending_id=NULL WHERE pending_id IS NOT NULL`);
    await restoreRows?.resume();
    await restoreSources?.resume();
    await restorePositions?.(true);
    await restoreRows?.complete();
    await restoreSources?.complete();
    await restorePositions?.complete();
  };
};
