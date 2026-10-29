import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { buildEmptyDatabase } from "./build-empty-database";

test("the engine image restores independent empty databases without application schema", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pstdio-empty-engine-image-"));
  const image = join(directory, "nested", "empty.tar.gz");
  try {
    await buildEmptyDatabase(image);
    for (let instance = 0; instance < 2; instance++) {
      const db = await PGlite.create({ database: "template1", username: "postgres", loadDataDir: Bun.file(image) });
      try {
        expect((await db.query("select datname from pg_database order by datname")).rows).toEqual([
          { datname: "template1" },
        ]);
        expect((await db.query("select tablename from pg_tables where schemaname = 'public'")).rows).toEqual([]);
        await db.exec("create table private_write(id integer); insert into private_write values (1)");
      } finally {
        await db.close();
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
