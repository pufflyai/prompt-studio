import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type SQL, sql } from "drizzle-orm";
import { projectExtensionRow } from "../services/extension-instances/project-extension-row";
import type { createDb } from "./connection.pglite";
import { project_extensions } from "./schemas.pg";
import { restoreTextStorageOwners } from "./storage-owner-upgrade.fixture";

const restoreReleasedInstances = async (
  connection: Awaited<ReturnType<typeof createDb>>,
  folder: string,
  files: string[],
) => {
  for (const file of files) {
    const source = await readFile(join(folder, file), "utf8");
    for (const statement of source.split("--> statement-breakpoint"))
      if (statement.trim().startsWith('CREATE TABLE "extension_instances" (')) await connection.pglite.exec(statement);
  }
  const instances = await connection.db.select().from(project_extensions);
  for (const row of instances) {
    const value = projectExtensionRow(row);
    await connection.pglite.query(
      `INSERT INTO extension_instances
      (id, installed_extension_id, scope_type, scope_id, display_name_override, enabled, config_json, diagnostics_json, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        value.id,
        value.installed_extension_id,
        value.scope_type,
        value.scope_id,
        value.display_name_override,
        value.enabled,
        JSON.stringify(value.config_json),
        value.diagnostics_json === null ? null : JSON.stringify(value.diagnostics_json),
        value.created_at,
        value.updated_at,
      ],
    );
  }
  await connection.pglite.exec("DROP TABLE project_extensions");
};

// Fixtures are created through current services, then reshaped to the actual
// released schema. The release stored ISO text, including on tables it kept.
const restoreReleasedTimestampColumns = async (connection: Awaited<ReturnType<typeof createDb>>) => {
  const preceding = JSON.parse(
    await readFile(join(import.meta.dirname, "../../drizzle/meta/0010_snapshot.json"), "utf8"),
  );
  const { rows } = await connection.db.execute<{ table_name: string; column_name: string }>(sql`
    SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND data_type='timestamp with time zone'`);
  const changes = new Map<string, SQL[]>();
  for (const { table_name, column_name } of rows) {
    if (preceding.tables[`public.${table_name}`]?.columns[column_name]?.type !== "text") continue;
    const column = sql.identifier(column_name);
    const columns = changes.get(table_name) ?? [];
    columns.push(sql`ALTER COLUMN ${column} TYPE text USING CASE
      WHEN date_trunc('milliseconds',${column})=${column}
      THEN to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ELSE to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END`);
    changes.set(table_name, columns);
  }
  for (const [table, columns] of changes)
    await connection.db.execute(sql`ALTER TABLE ${sql.identifier(table)} ${sql.join(columns, sql`, `)}`);
};

// These definitions come from the immutable migrations shipped in 0.48, not from
// the candidate schema. Exercise the actual released data shapes before upgrading.
export const restoreReleasedPreferenceTables = async (connection: Awaited<ReturnType<typeof createDb>>) => {
  await restoreTextStorageOwners(connection);
  const folder = join(import.meta.dirname, "../../drizzle");
  const files = (await readdir(folder)).filter((name) => /^000[0-9]_.*\.sql$/.test(name)).sort();
  await restoreReleasedInstances(connection, folder, files);
  await connection.pglite.exec(`
    ALTER TABLE board_views ADD COLUMN extension_instance_id text;
    UPDATE board_views b SET extension_instance_id = (
      SELECT i.id FROM extension_instances i JOIN extensions e ON e.id = i.installed_extension_id
      WHERE i.scope_type = 'project' AND i.scope_id = b.project_id AND e.extension_id = b.extension_id
      ORDER BY i.enabled DESC, i.updated_at DESC, i.id LIMIT 1
    );
    ALTER TABLE board_views DROP COLUMN extension_id;
    ALTER TABLE extensions RENAME TO installed_extension_sources;
    ALTER TABLE activity_events RENAME CONSTRAINT activity_events_source_extension_id_extensions_id_fk
      TO activity_events_source_extension_id_installed_extension_sources_id_fk;
  `);
  const tables = [
    "workspace_sessions",
    "skill_files",
    "extension_files",
    "automation_principals",
    "automation_tokens",
    "automation_runs",
    "settings",
    "local_environment",
    "extension_settings",
    "extension_skill_preferences",
    "extension_automation_preferences",
    "webview_preferences",
    "extension_connections",
    "board_default_views",
  ];
  await connection.pglite.exec("DROP TABLE automation_runs; DROP TABLE automation_tokens");
  const constraints: string[] = [];
  for (const file of files) {
    const source = await readFile(join(folder, file), "utf8");
    for (const statement of source.split("--> statement-breakpoint")) {
      const sql = statement.trim();
      if (tables.some((table) => sql.startsWith(`CREATE TABLE "${table}" (`))) await connection.pglite.exec(sql);
      if (
        [
          "workspace_sessions",
          "extension_instances",
          "skill_files",
          "extension_files",
          "automation_principals",
          "automation_tokens",
          "automation_runs",
        ].some(
          (table) =>
            sql.startsWith(`ALTER TABLE "${table}" ADD CONSTRAINT`) ||
            (sql.startsWith("CREATE ") && sql.includes(` ON "${table}" `)),
        )
      )
        constraints.push(sql);
      if (
        sql.startsWith('ALTER TABLE "board_views" ADD CONSTRAINT "board_views_extension_instance_id_') ||
        (sql.startsWith("CREATE INDEX ") && sql.includes(' ON "board_views" '))
      )
        constraints.push(sql);
      if (sql.startsWith("CREATE INDEX ") && sql.includes(' ON "installed_extension_sources" ')) constraints.push(sql);
    }
  }
  for (const statement of constraints) await connection.pglite.exec(statement);
  await connection.pglite.exec(`
    INSERT INTO skill_files (project_id, skill_id, path, file_id, created_at, updated_at)
      SELECT f.project_id, s.id, f.path, f.id, f.created_at, f.updated_at FROM files f
      JOIN skills s ON f.owner = 'skill:' || s.id AND f.project_id = s.project_id WHERE f.path IS NOT NULL;
    INSERT INTO extension_files (id, project_id, extension_instance_id, file_id, scope_type, scope_id, created_at)
      SELECT f.id, f.project_id, (SELECT i.id FROM extension_instances i
        JOIN installed_extension_sources e ON e.id = i.installed_extension_id
        WHERE i.scope_type = 'project' AND i.scope_id = f.project_id AND e.extension_id = f.owner
        ORDER BY i.enabled DESC, i.updated_at DESC, i.id LIMIT 1),
        f.id, f.scope::jsonb->>0, f.scope::jsonb->>1, f.created_at
      FROM files f WHERE f.owner IS NOT NULL AND f.owner <> 'pstdio'
        AND NOT starts_with(f.owner, 'skill:') AND f.scope IS NOT NULL;
    ALTER TABLE files DROP COLUMN owner; ALTER TABLE files DROP COLUMN scope; ALTER TABLE files DROP COLUMN path;
  `);
  await connection.pglite.exec(
    "DROP TABLE preferences; DROP TABLE credentials; ALTER TABLE board_views DROP COLUMN is_default; ALTER TABLE sessions DROP COLUMN workspace_id",
  );
  await connection.pglite.exec("ALTER TABLE session_queue_entries DROP COLUMN sender_json");
  await restoreReleasedTimestampColumns(connection);
  const journal = JSON.parse(await readFile(join(folder, "meta/_journal.json"), "utf8"));
  const appUpgrade = journal.entries.find((entry: { idx: number }) => entry.idx === 10);
  await connection.pglite.query("DELETE FROM drizzle.__drizzle_migrations WHERE created_at >= $1", [appUpgrade.when]);
};

export {
  readClosedDocumentText,
  readDocumentHistory,
  seedDocumentHistory,
} from "../services/extension-storage/document-history.fixture";
export { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
