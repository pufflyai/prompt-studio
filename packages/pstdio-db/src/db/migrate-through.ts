import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DbClient } from "./connection.pglite";

export const migrateThrough = async (db: DbClient, migrationsFolder: string, lastIndex: number) => {
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
