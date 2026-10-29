import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { resolvePgliteOptions } from "./connection.pglite";

test("the installed engine image restores independent empty databases without application schema", async () => {
  // Check the image installation produced; rebuilding here can hide a missing runtime asset.
  const runtime = await resolvePgliteOptions([]);
  for (let instance = 0; instance < 2; instance++) {
    const db = await PGlite.create(runtime);
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
});
