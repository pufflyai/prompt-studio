import { isDeepStrictEqual } from "node:util";
import { eq } from "drizzle-orm";
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

/** Device history is authoritative: capture every contribution and cursor before DDL. */
export const prepareHistoryOwnerUpgrade = async (db: DbClient, path: string) => {
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
    historyFields: ["device_id", "kind", "record_id", "value", "seed_id", "pending_id"],
  });
  const restoreSources = await prepareOwnedRowUpgrade(db, path, {
    source: {
      table: "storage_personal_history_sources",
      name: "history-source-owners",
      archive: "history-sources",
    },
    target: "history_sources",
    projectKey: "workbench_id",
    conflict: "Private history restoration conflict",
    keys: ["source_id", "kind", "device_id", "record_id"],
    historyFields: [
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
    await restoreRows?.resume();
    await restoreSources?.resume();
    await restorePositions?.(true);
    await restoreRows?.complete();
    await restoreSources?.complete();
    await restorePositions?.complete();
  };
};
