import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

export const prepareOwnedRowUpgrade = async (
  db: DbClient,
  path: string,
  config: {
    source: { table: string; name: string; archive: string; capture?: boolean };
    target: "history_rows" | "history_sources" | "asset_transfers";
    projectKey: "project_id" | "workbench_id";
    conflict: string;
    keys: string[];
    fields: string[];
    timestamps?: string[];
    normalize?: (row: Record<string, unknown>) => Record<string, unknown>;
  },
) => {
  const { source, target, projectKey, conflict, keys } = config;
  const table = sql.identifier(target);
  const primaryKey = sql.join(
    ["owner_id", ...keys].map((key) => sql.identifier(key)),
    sql`, `,
  );
  let owner: StorageOwner | undefined;
  let batch: Record<string, unknown>[] = [];
  let bytes = 0;
  const flush = async () => {
    const address = owner;
    if (!address || !batch.length) return;
    await db.transaction(async (tx) => {
      const ownerId = await ensureStorageOwner(tx, address);
      const input = sql`jsonb_populate_recordset(NULL::${table},
        ${JSON.stringify(batch.map((row) => ({ ...row, owner_id: ownerId })))}::jsonb)`;
      const inserted = await tx.execute(sql`INSERT INTO ${table} SELECT * FROM ${input}
        ON CONFLICT (${primaryKey}) DO NOTHING`);
      // On resume, a retained row must exactly match its durable input.
      if (inserted.affectedRows !== batch.length) {
        const { rows } = await tx.execute(sql`SELECT 1 FROM ${input} archived_row
          LEFT JOIN ${table} retained_row USING (${primaryKey})
          WHERE ROW(retained_row.*) IS DISTINCT FROM ROW(archived_row.*) LIMIT 1`);
        if (rows.length) throw new Error(conflict);
      }
    });
    batch = [];
    bytes = 0;
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    { ...source, copyJson: true, keys: [projectKey, "extension_id", ...keys] },
    async ({ [projectKey]: project, extension_id: extension, ...row }) => {
      if (typeof project !== "string" || typeof extension !== "string")
        throw new Error("Invalid released storage owner");
      const size = Buffer.byteLength(JSON.stringify(row));
      if (
        owner?.workbenchId !== project ||
        owner.extensionId !== extension ||
        batch.length >= 200 ||
        bytes + size > 4 * 1024 * 1024
      )
        await flush();
      owner = { workbenchId: project, extensionId: extension };
      batch.push(config.normalize ? config.normalize(row) : row);
      bytes += size;
    },
  );
  if (!restore) return;
  // The durable snapshot survives a process restart. On the uninterrupted path
  // the same database connection can copy rows directly across generated DDL.
  const staged = sql.identifier(`upgrade_${target}`);
  let stagedInput = restore.captured;
  if (stagedInput) await db.execute(sql`CREATE TEMP TABLE ${staged} AS TABLE ${sql.identifier(source.table)}`);
  return {
    async resume() {
      if (stagedInput) {
        const fields = config.fields.map((field) => sql.identifier(field));
        const ownerProject = sql.identifier(projectKey);
        const selected = config.fields.map((field) =>
          config.timestamps?.includes(field)
            ? sql`s.${sql.identifier(field)}::timestamptz`
            : sql`s.${sql.identifier(field)}`,
        );
        const existing = await db.execute(sql`SELECT 1 FROM ${table} LIMIT 1`);
        // A partial restore must check every saved row against its retained input.
        if (!existing.rows.length) {
          await db.transaction(async (tx) => {
            await tx.execute(sql`INSERT INTO owners(project_id,extension_id)
              SELECT DISTINCT ${ownerProject},extension_id FROM ${staged} ON CONFLICT DO NOTHING`);
            await tx.execute(sql`INSERT INTO ${table}(owner_id,${sql.join(fields, sql`, `)})
              SELECT o.id,${sql.join(selected, sql`, `)}
              FROM ${staged} s JOIN owners o ON (o.project_id,o.extension_id)=(s.${ownerProject},s.extension_id)`);
          });
          await db.execute(sql`DROP TABLE ${staged}`);
          stagedInput = false;
          return;
        }
        await db.execute(sql`DROP TABLE ${staged}`);
        stagedInput = false;
      }
      // Each retry starts at the beginning of its retained snapshot.
      batch = [];
      bytes = 0;
      await restore(true);
      await flush();
    },
    complete: restore.complete,
  };
};
