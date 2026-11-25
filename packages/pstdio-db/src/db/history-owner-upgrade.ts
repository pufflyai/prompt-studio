import { isDeepStrictEqual } from "node:util";
import { eq, sql } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { owners } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Address = { workbench_id: string; extension_id: string };
type LegacyPosition = Address & { cursor: string | null; migrated: boolean };
const ownerOf = (row: Address) => ({ workbenchId: row.workbench_id, extensionId: row.extension_id });
const same = (actual: unknown, expected: unknown) => {
  if (!isDeepStrictEqual(actual, expected)) throw new Error("Private history restoration conflict");
};

const prepareHistoryTable = async (
  db: DbClient,
  path: string,
  source: { table: string; name: string; archive: string },
  target: "history_rows" | "history_sources",
  keys: string[],
) => {
  const table = sql.identifier(target);
  const primaryKey = sql.join(
    ["owner_id", ...keys].map((key) => sql.identifier(key)),
    sql`, `,
  );
  let address: Address | undefined;
  let batch: Record<string, unknown>[] = [];
  let bytes = 0;
  const flush = async () => {
    if (!address || !batch.length) return;
    const owner = ownerOf(address);
    await db.transaction(async (tx) => {
      const ownerId = await ensureStorageOwner(tx, owner);
      const input = sql`jsonb_populate_recordset(NULL::${table},
        ${JSON.stringify(batch.map((row) => ({ ...row, owner_id: ownerId })))}::jsonb)`;
      const inserted = await tx.execute(sql`INSERT INTO ${table} SELECT * FROM ${input}
        ON CONFLICT (${primaryKey}) DO NOTHING`);
      // On resume, a retained row must exactly match its durable input.
      if (inserted.affectedRows !== batch.length) {
        const { rows } = await tx.execute(sql`SELECT 1 FROM ${input} expected
          LEFT JOIN ${table} actual USING (${primaryKey})
          WHERE actual IS DISTINCT FROM expected LIMIT 1`);
        if (rows.length) throw new Error("Private history restoration conflict");
      }
    });
    batch = [];
    bytes = 0;
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    { ...source, keys: ["workbench_id", "extension_id", ...keys] },
    async ({ workbench_id, extension_id, ...row }) => {
      if (typeof workbench_id !== "string" || typeof extension_id !== "string")
        throw new Error("Invalid history owner");
      const size = Buffer.byteLength(JSON.stringify(row));
      if (
        address?.workbench_id !== workbench_id ||
        address.extension_id !== extension_id ||
        batch.length >= 1000 ||
        bytes + size > 4 * 1024 * 1024
      )
        await flush();
      address = { workbench_id, extension_id };
      batch.push(row);
      bytes += size;
    },
  );
  if (!restore) return;
  return {
    async resume() {
      // Each retry starts at the beginning of its retained snapshot.
      batch = [];
      bytes = 0;
      await restore(true);
      await flush();
    },
    complete: restore.complete,
  };
};

/** Device history is authoritative: capture every contribution and cursor before DDL. */
export const prepareHistoryOwnerUpgrade = async (db: DbClient, path: string) => {
  const restoreRows = await prepareHistoryTable(
    db,
    path,
    {
      table: "storage_personal_history",
      name: "history-row-owners",
      archive: "history-rows",
    },
    "history_rows",
    ["kind", "device_id", "record_id"],
  );
  const restoreSources = await prepareHistoryTable(
    db,
    path,
    {
      table: "storage_personal_history_sources",
      name: "history-source-owners",
      archive: "history-sources",
    },
    "history_sources",
    ["source_id", "kind", "device_id", "record_id"],
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
    await restoreRows?.resume();
    await restoreSources?.resume();
    await restorePositions?.(true);
    await restoreRows?.complete();
    await restoreSources?.complete();
    await restorePositions?.complete();
  };
};
