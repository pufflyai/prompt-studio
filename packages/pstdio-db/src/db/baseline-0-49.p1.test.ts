import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { createDb } from "./connection.pglite";
import { retireLegacyRecordTables } from "./legacy-record-retirement";
import { createTextLogOwnerFixture } from "./log-owner-upgrade.fixture";
import { engineFile } from "./pglite-home-recovery";

const journal = async (db: PGlite) =>
  (await db.query("SELECT hash,created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows;
const layout = async (db: PGlite) =>
  Promise.all(
    [
      "SELECT c.relname,c.relkind FROM pg_class c WHERE c.relnamespace='public'::regnamespace ORDER BY 1",
      "SELECT table_name,column_name,is_nullable,udt_name,column_default,identity_generation FROM information_schema.columns WHERE table_schema='public' ORDER BY 1,2",
      "SELECT conrelid::regclass::text,conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2",
      "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2",
      "SELECT typname,enumlabel,enumsortorder FROM pg_enum JOIN pg_type ON enumtypid=pg_type.oid WHERE typnamespace='public'::regnamespace ORDER BY 1,3",
    ].map(async (sql) => (await db.query(sql)).rows),
  );

test("a populated early 0.49 database and a new installation share the compact journal and schema", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-squashed-"));
  try {
    const fresh = await createDb({ path: join(root, "fresh") });
    let expectedJournal, expectedLayout;
    try {
      expectedJournal = await journal(fresh.pglite);
      expect(expectedJournal).toHaveLength(1);
      expectedLayout = await layout(fresh.pglite);
    } finally {
      await fresh.close();
    }
    const old = await createTextLogOwnerFixture(root, 12);
    try {
      await retireLegacyRecordTables(old.pglite, join(import.meta.dirname, "../../drizzle-0.46"));
      expect(await journal(old.pglite)).toHaveLength(13);
      await old.pglite.exec(
        "INSERT INTO projects(id,name,shorthand,created_at,updated_at) VALUES ('saved','Retained','RT',now(),now())",
      );
    } finally {
      await old.close();
    }
    for (let i = 0; i < 2; i++) {
      const current = await createDb({ path: old.path });
      try {
        expect(await journal(current.pglite)).toEqual(expectedJournal);
        expect(await layout(current.pglite)).toEqual(expectedLayout);
        expect((await current.pglite.query("SELECT name FROM projects WHERE id='saved'")).rows).toEqual([
          { name: "Retained" },
        ]);
        expect(JSON.parse(await readFile(join(old.path, engineFile), "utf8")).baseline).toBe("0.49");
      } finally {
        await current.close();
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
