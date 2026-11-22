import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { resourceNumbersDocumentId } from "pstdio-sync/records";
import { storageOwnerKey } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

const normalized = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (typeof value === "bigint") return [key, value.toString()];
      if (value instanceof Uint8Array) return [key, `\\x${Buffer.from(value).toString("hex")}`];
      return [key, value];
    }),
  );
const digest = (row: Record<string, unknown>) =>
  createHash("sha256")
    .update(JSON.stringify(Object.entries(row).sort()))
    .digest("hex");

/** Preserve the exact residual Yjs source, including alias membership and its original
 * resource IDs. The converted history records need only allocation floors. */
export const prepareLegacyNumberInput = async (db: DbClient, database: string, owner: StorageOwner) => {
  const [{ id }] = (await db.execute<{ id: number }>(sql`SELECT ${storageOwnerKey(owner)} AS id`)).rows;
  const scope = sql`owner_id=${id} AND document_id=${resourceNumbersDocumentId}`;
  const snapshots: NonNullable<Awaited<ReturnType<typeof prepareUpgradeSnapshot>>>[] = [];
  let graphHash = "";
  const sources = [
    ["storage_documents", ["owner_id", "document_id"]],
    ["storage_document_updates", ["owner_id", "document_id", "revision"]],
    ["storage_document_operations", ["owner_id", "document_id", "operation_id"]],
  ] as const;
  for (const [table, keys] of sources) {
    const snapshot = await prepareUpgradeSnapshot(
      db,
      database,
      {
        table,
        keys,
        where: scope,
        name: `legacy-number-${id}-${table}`,
        archive: () => `legacy-number-${id}-${graphHash}-${table}`,
      },
      async (row) => {
        const key = sql.join(
          keys.map((key) => sql`${sql.identifier(key)}=${row[key]}`),
          sql` AND `,
        );
        const {
          rows: [current],
        } = await db.execute<Record<string, unknown>>(sql`SELECT * FROM ${sql.identifier(table)} WHERE ${key}`);
        const { source_owner, ...original } = row;
        if (
          JSON.stringify(source_owner) !== JSON.stringify(owner) ||
          !current ||
          digest(normalized(current)) !== digest(original)
        )
          throw new Error("Legacy number input changed during admission");
      },
      async (row) => ({ ...normalized(row), source_owner: owner }),
    );
    if (snapshot) snapshots.push(snapshot);
  }
  if (database !== ":memory:") {
    // Address the entire graph, not each table separately: an unchanged document
    // row can have distinct Yjs tails in two successive retained inputs.
    const hash = createHash("sha256");
    for (const [table] of sources) {
      hash.update(`${table}\0`);
      for await (const chunk of createReadStream(`${database}-legacy-number-${id}-${table}-upgrade.jsonl`))
        hash.update(chunk);
      hash.update("\0");
    }
    graphHash = hash.digest("hex");
  }
  return async () => {
    // All inputs remain live until every original snapshot has been validated and fsynced.
    for (const snapshot of snapshots) await snapshot(true);
    for (const snapshot of snapshots) await snapshot.complete();
  };
};
