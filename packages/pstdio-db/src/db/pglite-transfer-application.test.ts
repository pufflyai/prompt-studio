import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite as NextPGlite } from "pglite-next";
import { exportPgliteDatabase, importPgliteDatabase } from "./pglite-transfer";
import { quoteIdentifier, type TransferDatabase } from "./pglite-transfer-format";

const readApplication = async (db: TransferDatabase) => {
  const tables = await db.query<{ schema: string; name: string }>(
    "select table_schema schema,table_name name from information_schema.tables where table_schema not in ('pg_catalog','information_schema') and table_type='BASE TABLE' order by 1,2",
  );
  const rows: Record<string, unknown> = {};
  for (const table of tables.rows) {
    const name = `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`;
    rows[name] = (
      await db.query(`select to_jsonb(t)::text value from ${name} t order by to_jsonb(t)::text collate "C"`)
    ).rows;
  }
  const columns = await db.query(
    "select table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name,ordinal_position",
  );
  const indexes = await db.query(
    "select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname not in ('pg_catalog','information_schema') order by 1,2,3",
  );
  const constraints = await db.query(
    "select n.nspname,r.relname,c.conname,pg_get_constraintdef(c.oid) definition from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace where n.nspname not in ('pg_catalog','information_schema') order by 1,2,3",
  );
  return { rows, columns: columns.rows, indexes: indexes.rows, constraints: constraints.rows };
};

test("the application schema transfers document bytes, receipts and all migration state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pglite-application-transfer-"));
  const old = await PGlite.create();
  const next = await NextPGlite.create({ database: "template1", username: "postgres" });
  try {
    await migrate(drizzle(old), { migrationsFolder: join(import.meta.dirname, "../../drizzle") });
    await old.exec(
      "insert into projects(id,name,shorthand,created_at,updated_at) values ('project','Original','P','2026-01-01','2026-01-02')",
    );
    const snapshot = Uint8Array.from({ length: 700_000 }, (_, i) => i % 251);
    await old.query(
      "insert into storage_documents(workbench_id,extension_id,document_id,state,revision,folded_revision) values ('project','example.owner','records',$1,2,1)",
      [snapshot],
    );
    await old.query(
      "insert into storage_document_updates(workbench_id,extension_id,document_id,revision,\"update\") values ('project','example.owner','records',2,$1)",
      [new Uint8Array([0, 255, 17])],
    );
    await old.exec(
      "insert into storage_document_operations values ('project','example.owner','records','retry-id','exact-fingerprint')",
    );
    const expected = await readApplication(old);
    await exportPgliteDatabase(old, directory);
    await importPgliteDatabase(next, directory);
    expect(await readApplication(next)).toEqual(expected);
    expect(
      (await next.query<{ count: number }>("select count(*)::integer count from drizzle.__drizzle_migrations")).rows[0]
        .count,
    ).toBeGreaterThan(40);
  } finally {
    await old.close();
    await next.close();
    await rm(directory, { recursive: true, force: true });
  }
});
