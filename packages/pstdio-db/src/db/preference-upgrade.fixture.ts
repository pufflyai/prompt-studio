import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { createDb } from "./connection.pglite";

// These definitions come from the immutable migrations shipped in 0.48, not from
// the candidate schema. Exercise the actual released data shapes before upgrading.
export const restoreReleasedPreferenceTables = async (connection: Awaited<ReturnType<typeof createDb>>) => {
  const tables = [
    "settings",
    "local_environment",
    "extension_settings",
    "extension_skill_preferences",
    "extension_automation_preferences",
    "webview_preferences",
    "extension_connections",
    "board_default_views",
  ];
  const folder = join(import.meta.dirname, "../../drizzle");
  const files = (await readdir(folder)).filter((name) => /^000[0-9]_.*\.sql$/.test(name)).sort();
  for (const file of files) {
    const source = await readFile(join(folder, file), "utf8");
    for (const statement of source.split("--> statement-breakpoint")) {
      const sql = statement.trim();
      if (tables.some((table) => sql.startsWith(`CREATE TABLE "${table}" (`))) await connection.pglite.exec(sql);
    }
  }
  await connection.pglite.exec(
    "DROP TABLE preferences; DROP TABLE credentials; ALTER TABLE board_views DROP COLUMN is_default",
  );
  const migrations = await connection.pglite.query<{ id: number }>(
    "SELECT id FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
  );
  await connection.pglite.query("DELETE FROM drizzle.__drizzle_migrations WHERE id = $1", [migrations.rows[0].id]);
};
