import { isDeepStrictEqual } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import type { Json, StorageRecordIndex } from "pstdio-sync-contracts";
import { formatDatabasePrefix } from "../services/extension-storage/record-format-key";
import { dropRecordIndexObjects, queryDefinitionName } from "../services/extension-storage/record-index-lifecycle";
import { recordIndexRows, saveRecordIndexRow } from "../services/extension-storage/record-index-rows";
import { decodeProjectionValue } from "../services/extension-storage/record-projection-codec";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { readUpgradeRows } from "./upgrade-rows";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const restoreIndex = async (tx: Transaction, input: Record<string, unknown>) => {
  if (
    typeof input.workbench_id !== "string" ||
    typeof input.extension_id !== "string" ||
    typeof input.name !== "string" ||
    typeof input.database_name !== "string"
  )
    throw new Error("Invalid exported owner index declaration");
  const owner = { workbenchId: input.workbench_id, extensionId: input.extension_id };
  const ownerId = await ensureStorageOwner(tx, owner);
  const definition = decodeProjectionValue(input.definition as Json) as unknown as StorageRecordIndex;
  const cached = input.database_name.startsWith(formatDatabasePrefix);
  const database_name = cached ? input.database_name : await queryDefinitionName(owner, ownerId, definition);
  const [existing] = await tx
    .select()
    .from(recordIndexRows)
    .where(and(eq(recordIndexRows.owner_id, ownerId), eq(recordIndexRows.name, input.name)));
  if (existing) {
    if (!isDeepStrictEqual(existing.definition, input.definition)) throw new Error("Owner index restoration conflict");
    if (existing.database_name === database_name) return;
    if (!existing.database_name.startsWith("storage_query_")) throw new Error("Owner index restoration conflict");
    await dropRecordIndexObjects(tx, [existing]);
  }
  await saveRecordIndexRow(tx, {
    owner_id: ownerId,
    name: input.name,
    database_name,
    definition: input.definition as StorageRecordIndex,
  });
};

const dropReleasedIndexes = async (db: DbClient) => {
  for await (const row of readUpgradeRows(db, {
    table: "storage_record_indexes",
    keys: ["workbench_id", "extension_id", "name"],
  }))
    await dropRecordIndexObjects(
      db,
      [
        {
          definition: row.definition as StorageRecordIndex,
          database_name: String(row.database_name),
        },
      ],
      "released",
    );
  await db.execute(sql`DELETE FROM storage_record_indexes`);
};

/** Keep released declarations durable until their owner metadata and generated query objects commit. */
export const prepareOwnerIndexUpgrade = async (db: DbClient, path: string) => {
  const pending: Record<string, unknown>[] = [];
  let pendingBytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    pendingBytes = 0;
    await db.transaction(async (tx) => {
      for (const input of batch) await restoreIndex(tx, input);
    });
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_record_indexes",
      keys: ["workbench_id", "extension_id", "name"],
      name: "storage_record_indexes-owners",
      archive: "storage_record_indexes",
    },
    async (input) => {
      const bytes = Buffer.byteLength(JSON.stringify(input));
      if (pending.length && pendingBytes + bytes > 4 * 1024 * 1024) await flush();
      pending.push(input);
      pendingBytes += bytes;
      if (pending.length === 200) await flush();
    },
  );
  if (!restore) return;
  const {
    rows: [legacy],
  } = await db.execute<{ present: boolean }>(sql`SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='storage_record_indexes') AS present`);
  if (legacy!.present) await dropReleasedIndexes(db);
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
