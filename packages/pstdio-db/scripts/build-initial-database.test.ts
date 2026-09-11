import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { buildInitialDatabase } from "./build-initial-database";

test("packages the current empty application schema with its migration history", async () => {
  const home = await mkdtemp(join(tmpdir(), "pstdio-initial-database-"));
  const imagePath = join(home, "initial.tar.gz");
  let db: PGlite | undefined;
  try {
    await buildInitialDatabase(imagePath);
    db = await PGlite.create({ loadDataDir: Bun.file(imagePath) });
    expect((await db.query("SELECT * FROM projects")).rows).toEqual([]);
    const migrationsFolder = join(import.meta.dirname, "../drizzle");
    const expected = readMigrationFiles({ migrationsFolder }).map(({ hash, folderMillis }) => ({
      hash,
      created_at: folderMillis,
    }));
    const history = () => db!.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at");
    expect((await history()).rows).toEqual(expected);
    await migrate(drizzle(db), { migrationsFolder });
    expect((await history()).rows).toEqual(expected);
  } finally {
    await db?.close();
    await rm(home, { recursive: true, force: true });
  }
});
