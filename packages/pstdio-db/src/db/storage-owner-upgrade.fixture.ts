import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { createDb } from "./connection.pglite";

/** Preserve seeded data when an app-upgrade fixture reconstructs the released storage schema. */
export const restoreTextStorageOwners = async (connection: Awaited<ReturnType<typeof createDb>>) => {
  const query = async (source: string) =>
    (await connection.pglite.query<{ row: Record<string, unknown> }>(source)).rows.map(({ row }) => row);
  const orderedTables = [
    "storage_ordered_owners",
    "storage_ordered_operations",
    "storage_ordered_records",
    "storage_ordered_touches",
    "storage_ordered_receipts",
  ];
  const ordered: Record<string, Record<string, unknown>[]> = {};
  for (const table of orderedTables)
    ordered[table] = await query(`SELECT (to_jsonb(s)-'owner_id') ||
      jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
      FROM ${table} s JOIN owners o ON s.owner_id=o.id`);
  const orderedSequence = (
    await connection.pglite.query<{ last_value: string; is_called: boolean }>(
      "SELECT last_value,is_called FROM storage_ordered_operations_local_sequence_seq",
    )
  ).rows[0]!;
  const assets = await query(`SELECT (to_jsonb(a)-'owner_id') ||
    jsonb_build_object('project_id',o.project_id,'extension_id',o.extension_id) AS row
    FROM asset_transfers a JOIN owners o ON a.owner_id=o.id`);
  const logs = await query(`SELECT (to_jsonb(s)-'id'-'owner_id') ||
    jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
    FROM log_streams s JOIN owners o ON s.owner_id=o.id`);
  const entries = await query(`SELECT (to_jsonb(e)-'stream_id') || jsonb_build_object(
    'workbench_id',o.project_id,'extension_id',o.extension_id,'log_name',s.log_name,'scope',s.scope,'stream',s.stream) AS row
    FROM log_entries e JOIN log_streams s ON e.stream_id=s.id JOIN owners o ON s.owner_id=o.id`);
  const history = async (table: string) =>
    query(`SELECT (to_jsonb(h)-'owner_id') ||
    jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
    FROM ${table} h JOIN owners o ON h.owner_id=o.id`);
  const rows = await history("history_rows");
  const sources = await history("history_sources");
  const positions = await query(`SELECT jsonb_build_object('workbench_id',project_id,'extension_id',extension_id,
    'cursor',history_cursor,'migrated',history_migrated) AS row FROM owners`);
  const sequence = (
    await connection.pglite.query<{ last_value: string; is_called: boolean }>(
      "SELECT last_value,is_called FROM log_entries_local_sequence_seq",
    )
  ).rows[0]!;
  await connection.pglite.exec(
    "DROP TABLE storage_ordered_receipts; DROP TABLE storage_ordered_touches; DROP TABLE storage_ordered_records; DROP TABLE storage_ordered_operations; DROP TABLE storage_ordered_owners; DROP TABLE asset_transfers; DROP TABLE log_entries; DROP TABLE log_streams; DROP TABLE history_sources; DROP TABLE history_rows; DROP TABLE owners",
  );
  const data = {
    ...ordered,
    asset_transfers: assets,
    storage_log_streams: logs,
    storage_log_entries: entries,
    storage_personal_history: rows,
    storage_personal_history_sources: sources,
    storage_personal_history_positions: positions,
  };
  const tables = Object.keys(data);
  const folder = join(import.meta.dirname, "../../drizzle");
  const files = (await readdir(folder)).filter((name) => /^(000\d|0010)_.*\.sql$/u.test(name)).sort();
  const constraints: string[] = [];
  for (const file of files)
    for (const input of (await readFile(join(folder, file), "utf8")).split("--> statement-breakpoint")) {
      const statement = input.trim();
      if (tables.some((table) => statement.startsWith(`CREATE TABLE "${table}" (`)))
        await connection.pglite.exec(statement);
      if (
        tables.some(
          (table) =>
            statement.startsWith(`ALTER TABLE "${table}" ADD CONSTRAINT`) ||
            (statement.startsWith("CREATE ") && statement.includes(` ON "${table}" `)),
        )
      )
        constraints.push(statement);
    }
  for (const statement of constraints) await connection.pglite.exec(statement);
  for (const [table, values] of Object.entries(data))
    for (const row of values) {
      const columns = Object.keys(row);
      await connection.pglite.query(
        `INSERT INTO ${table} (${columns.map((column) => `"${column}"`).join(",")})
        VALUES (${columns.map((_, index) => `$${index + 1}`).join(",")})`,
        columns.map((column) => {
          const value = row[column];
          const binaryColumns: Record<string, string[]> = {
            storage_log_entries: ["entry", "envelope"],
            storage_ordered_owners: ["receipt_root"],
            storage_ordered_records: ["state"],
            storage_ordered_operations: ["envelope", "admission"],
          };
          if (binaryColumns[table]?.includes(column) && value !== null) {
            if (typeof value !== "string" || !/^\\x(?:[0-9a-f]{2})*$/u.test(value))
              throw new Error(`Invalid released storage bytes: ${column}`);
            return new Uint8Array(Buffer.from(value.slice(2), "hex"));
          }
          return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
        }),
      );
    }
  await connection.pglite.query("SELECT setval('storage_ordered_operations_local_sequence_seq',$1,$2)", [
    orderedSequence.last_value,
    orderedSequence.is_called,
  ]);
  await connection.pglite.query("SELECT setval('storage_log_entries_local_sequence_seq' ,$1,$2)", [
    sequence.last_value,
    sequence.is_called,
  ]);
};
