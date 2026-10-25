import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { buildInitialDatabase } from "./build-initial-database";

test("builds a migrated starter database that holds only the database the runtime opens", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-initial-database-"));
  const imagePath = join(root, "initial-database.tar.gz");
  try {
    await buildInitialDatabase(imagePath);

    const image = new Blob([readFileSync(imagePath)], { type: "application/gzip" });
    const db = await PGlite.create({ database: "template1", username: "postgres", loadDataDir: image });
    try {
      expect((await db.query("SELECT datname FROM pg_database")).rows).toEqual([{ datname: "template1" }]);
      expect((await db.query("SELECT to_regclass('public.projects')::text AS projects")).rows).toEqual([
        { projects: "projects" },
      ]);
    } finally {
      await db.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
