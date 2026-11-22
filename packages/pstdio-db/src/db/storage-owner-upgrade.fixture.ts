import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { dropRecordIndexes } from "../services/extension-storage/record-index-lifecycle";
import type { createDb } from "./connection.pglite";
import { decodeUpgradeBytes } from "./upgrade-bytes";

/** Preserve seeded data when an app-upgrade fixture reconstructs the released storage schema. */
export const restoreTextStorageOwners = async (connection: Awaited<ReturnType<typeof createDb>>) => {
  const query = async (source: string) =>
    (await connection.pglite.query<{ row: Record<string, unknown> }>(source)).rows.map(({ row }) => row);
  const links =
    await query(`SELECT to_jsonb(link) AS row FROM (SELECT s.project_id,s.extension_id AS source_owner,l.source_kind,l.source_id,
    t.extension_id AS target_owner,l.target_kind,l.target_id,l.role,l.details
    FROM resource_links l JOIN owners s ON l.source_owner=s.id JOIN owners t ON l.target_owner=t.id) link`);
  const documentTables = [
    "storage_documents",
    "storage_document_updates",
    "storage_document_operations",
    "storage_record_projections",
    "storage_current_records",
    "storage_record_indexes",
  ];
  const documents: Record<string, Record<string, unknown>[]> = {};
  const documentRows = async (table: string) => {
    if (table === "storage_record_projections")
      return query(`SELECT jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id,
        'document_id','records','revision',o.revision,'live_count',o.live_count) AS row FROM owners o
        WHERE EXISTS (SELECT 1 FROM storage_documents d WHERE d.owner_id=o.id AND d.document_id='records')`);
    if (table === "storage_record_indexes")
      return query(`SELECT jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id,
        'name',entry.key,'definition',entry.value->'definition','database_name',entry.value->'database_name') AS row
        FROM owners o CROSS JOIN LATERAL jsonb_each(o.record_indexes) AS entry(key,value)`);
    return query(`SELECT (to_jsonb(d)-'owner_id') ||
        jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
        FROM ${table} d JOIN owners o ON d.owner_id=o.id`);
  };
  for (const table of documentTables) documents[table] = await documentRows(table);
  documents.storage_resource_projections = await query(`SELECT (to_jsonb(d)-'owner_id') ||
    jsonb_build_object('extension_id',o.extension_id) AS row FROM storage_resource_projections d JOIN owners o ON d.owner_id=o.id`);
  documents.storage_resource_identities = await query("SELECT to_jsonb(d) AS row FROM storage_resource_identities d");
  documents.storage_resource_aliases = await query("SELECT to_jsonb(d) AS row FROM storage_resource_aliases d");
  // The released reconstruction owns these generated query objects too.
  await dropRecordIndexes(connection.db, sql`true`);
  const ordered: Record<string, Record<string, unknown>[]> = {
    storage_ordered_owners:
      await query(`SELECT jsonb_build_object('workbench_id',project_id,'extension_id',extension_id,
      'epoch',epoch,'joined',joined,'after',"after",'state_id',state_id,'through',through,
      'pending_bytes',pending_bytes,'state_bytes',state_bytes,'skipped',skipped,'receipt_root',receipt_root) AS row
      FROM owners`),
  };
  for (const table of [
    "storage_ordered_operations",
    "storage_ordered_records",
    "storage_ordered_touches",
    "storage_ordered_receipts",
  ])
    ordered[table] = await query(`SELECT (to_jsonb(s)-'owner_id') ||
      jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
      FROM ${table} s JOIN owners o ON s.owner_id=o.id`);
  const orderedSequence = (
    await connection.pglite.query<{ last_value: string; is_called: boolean }>(
      "SELECT last_value,is_called FROM storage_ordered_operations_local_sequence_seq",
    )
  ).rows[0]!;
  const recovery = await query(`SELECT (to_jsonb(r)-'owner_id'-'project_id') ||
    jsonb_build_object('workbench_id',r.project_id,'extension_id',o.extension_id) AS row
    FROM recovery_point_owners r JOIN owners o ON r.owner_id=o.id`);
  const points = await query(`SELECT (to_jsonb(r)-'project_id') ||
    jsonb_build_object('workbench_id',project_id) AS row FROM recovery_points r`);
  const native: Record<string, Record<string, unknown>[]> = {};
  for (const table of ["native_document_sources", "native_document_rooms", "native_document_file_projections"])
    native[table] = await query(`SELECT (to_jsonb(n)-'owner_id') ||
      jsonb_build_object('workbench_id',o.project_id,'extension_id',o.extension_id) AS row
      FROM ${table} n JOIN owners o ON n.owner_id=o.id`);
  native.native_document_room_updates = await query("SELECT to_jsonb(n) AS row FROM native_document_room_updates n");
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
    "DROP TABLE resource_links; DROP TABLE storage_resource_aliases; DROP TABLE storage_resource_identities; DROP TABLE storage_resource_projections; DROP TABLE storage_current_records; DROP TABLE storage_document_operations; DROP TABLE storage_document_updates; DROP TABLE storage_documents; DROP TABLE native_document_room_updates; DROP TABLE native_document_rooms; DROP TABLE native_document_file_projections; DROP TABLE native_document_sources; DROP TABLE recovery_point_owners; DROP TABLE recovery_points; DROP TABLE storage_ordered_receipts; DROP TABLE storage_ordered_touches; DROP TABLE storage_ordered_records; DROP TABLE storage_ordered_operations; DROP TABLE IF EXISTS storage_ordered_owners; DROP TABLE asset_transfers; DROP TABLE log_entries; DROP TABLE log_streams; DROP TABLE history_sources; DROP TABLE history_rows; DROP TABLE owners",
  );
  const data = {
    resource_anchors: links,
    ...documents,
    native_document_sources: native.native_document_sources!,
    native_document_file_projections: native.native_document_file_projections!,
    native_document_rooms: native.native_document_rooms!,
    native_document_room_updates: native.native_document_room_updates!,
    recovery_points: points,
    recovery_point_owners: recovery,
    ...ordered,
    storage_record_sync: [],
    storage_record_outbox: [],
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
      if (tables.some((table) => statement.startsWith(`ALTER TABLE "${table}" ADD COLUMN `)))
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
            storage_documents: ["state"],
            storage_document_updates: ["update"],
            native_document_rooms: ["state"],
            native_document_room_updates: ["update"],
            native_document_file_projections: ["baseline", "pending"],
            recovery_point_owners: ["records", "metadata"],
            storage_log_entries: ["entry", "envelope"],
            storage_ordered_owners: ["receipt_root"],
            storage_ordered_records: ["state"],
            storage_ordered_operations: ["envelope", "admission"],
          };
          if (binaryColumns[table]?.includes(column) && value !== null) {
            return decodeUpgradeBytes(value);
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
