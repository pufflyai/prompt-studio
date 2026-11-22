import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { storage_personal_history as history, owners, storage_personal_history_sources as sources } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Address = { workbench_id: string; extension_id: string };
type LegacyRow = Address & Omit<typeof history.$inferSelect, "owner_id">;
type LegacySource = Address & Omit<typeof sources.$inferSelect, "owner_id">;
type LegacyPosition = Address & { cursor: string | null; migrated: boolean };
const ownerOf = (row: Address) => ({ workbenchId: row.workbench_id, extensionId: row.extension_id });
const same = (actual: unknown, expected: unknown) => {
  if (!isDeepStrictEqual(actual, expected)) throw new Error("Private history restoration conflict");
};

/** Device history is authoritative: capture every contribution and cursor before DDL. */
export const prepareHistoryOwnerUpgrade = async (db: DbClient, path: string) => {
  const restoreRows = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_personal_history",
      keys: ["workbench_id", "extension_id", "kind", "device_id", "record_id"],
      name: "history-row-owners",
      archive: "history-rows",
    },
    async (input) => {
      const { workbench_id, extension_id, ...fields } = input as LegacyRow;
      await db.transaction(async (tx) => {
        const ownerId = await ensureStorageOwner(tx, ownerOf({ workbench_id, extension_id }));
        const expected = { ...fields, owner_id: ownerId };
        const where = and(
          eq(history.owner_id, ownerId),
          eq(history.kind, fields.kind),
          eq(history.device_id, fields.device_id),
          eq(history.record_id, fields.record_id),
        );
        const [existing] = await tx.select().from(history).where(where);
        if (existing) same(existing, expected);
        else await tx.insert(history).values(expected);
      });
    },
  );
  const restoreSources = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_personal_history_sources",
      keys: ["workbench_id", "extension_id", "source_id", "kind", "device_id", "record_id"],
      name: "history-source-owners",
      archive: "history-sources",
    },
    async (input) => {
      const { workbench_id, extension_id, ...fields } = input as LegacySource;
      await db.transaction(async (tx) => {
        const ownerId = await ensureStorageOwner(tx, ownerOf({ workbench_id, extension_id }));
        const expected = { ...fields, owner_id: ownerId, sequence: Number(fields.sequence) };
        const where = and(
          eq(sources.owner_id, ownerId),
          eq(sources.source_id, fields.source_id),
          eq(sources.kind, fields.kind),
          eq(sources.device_id, fields.device_id),
          eq(sources.record_id, fields.record_id),
        );
        const [existing] = await tx.select().from(sources).where(where);
        if (existing) same(existing, expected);
        else await tx.insert(sources).values(expected);
      });
    },
  );
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
    await restoreRows?.(true);
    await restoreSources?.(true);
    await restorePositions?.(true);
    await restoreRows?.complete();
    await restoreSources?.complete();
    await restorePositions?.complete();
  };
};
