import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { PgDialect } from "drizzle-orm/pg-core";
import type { DbClient } from "./connection.pglite";
import { archiveRetiredTable } from "./retired-data";

export const migrateThrough = async (db: DbClient, migrationsFolder: string, lastIndex = Number.POSITIVE_INFINITY) => {
  const config = { migrationsFolder };
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string; when: number }[];
  };
  const migrations = readMigrationFiles(config);
  const dialect = new PgDialect();
  // Use Drizzle's executor with the selected history, without staging SQL in a writable temp directory.
  const applyThrough = (index: number) =>
    dialect.migrate(
      migrations.filter((_, offset) => journal.entries[offset].idx <= index),
      // The executor uses SQL only; its session type assumes an empty relational schema (ADR 0078).
      db._.session as unknown as Parameters<PgDialect["migrate"]>[1],
      config,
    );
  const metadata = await db.execute(sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS name`);
  let applied = 0;
  if (metadata.rows[0]?.name) {
    const latest = await db.execute(
      sql`SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
    );
    applied = Number(latest.rows[0]?.created_at ?? 0);
  }
  for (const [offset, entry] of journal.entries.entries()) {
    if (entry.idx > lastIndex || entry.when <= applied) continue;
    const retired = [
      ...migrations[offset].sql.join("\n").matchAll(/DROP TABLE\s+(?:IF EXISTS\s+)?(?:"public"\.)?"([^"]+)"/g),
    ];
    if (retired.length === 0) continue;
    // Earlier migrations may still change the old table's format. Retain it at
    // the removal boundary, without teaching core how an extension uses its rows.
    await applyThrough(entry.idx - 1);
    const previous = journal.entries.find((candidate) => candidate.idx === entry.idx - 1)?.tag ?? "initial";
    for (const match of retired) await archiveRetiredTable(db, match[1], previous);
    await applyThrough(entry.idx);
  }
  await applyThrough(lastIndex);
};
