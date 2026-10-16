import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DbClient } from "./connection.pglite";
import { archiveRetiredTable } from "./retired-data";

const applyThrough = async (db: DbClient, migrationsFolder: string, lastIndex: number) => {
  const stage = mkdtempSync(join(tmpdir(), "pstdio-migrations-"));
  mkdirSync(join(stage, "meta"));
  try {
    const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const entries = journal.entries.filter((entry) => entry.idx <= lastIndex);
    writeFileSync(join(stage, "meta/_journal.json"), JSON.stringify({ ...journal, entries }));
    for (const entry of entries)
      copyFileSync(join(migrationsFolder, `${entry.tag}.sql`), join(stage, `${entry.tag}.sql`));
    await migrate(db, { migrationsFolder: stage });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
};

export const migrateThrough = async (db: DbClient, migrationsFolder: string, lastIndex = Number.POSITIVE_INFINITY) => {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string; when: number }[];
  };
  const metadata = await db.execute(sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS name`);
  let applied = 0;
  if (metadata.rows[0]?.name) {
    const latest = await db.execute(
      sql`SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
    );
    applied = Number(latest.rows[0]?.created_at ?? 0);
  }
  for (const entry of journal.entries) {
    if (entry.idx > lastIndex || entry.when <= applied) continue;
    const statements = readFileSync(join(migrationsFolder, `${entry.tag}.sql`), "utf8");
    const retired = [...statements.matchAll(/DROP TABLE\s+(?:IF EXISTS\s+)?(?:"public"\.)?"([^"]+)"/g)];
    if (retired.length === 0) continue;
    // Earlier migrations may still change the old table's format. Retain it at
    // the removal boundary, without teaching core how an extension uses its rows.
    await applyThrough(db, migrationsFolder, entry.idx - 1);
    const previous = journal.entries.find((candidate) => candidate.idx === entry.idx - 1)?.tag ?? "initial";
    for (const match of retired) await archiveRetiredTable(db, match[1], previous);
    await applyThrough(db, migrationsFolder, entry.idx);
  }
  await applyThrough(db, migrationsFolder, lastIndex);
};
