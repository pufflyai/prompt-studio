import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite as NextPGlite } from "@electric-sql/pglite";
import { PGlite } from "pglite-previous";
import { exportPgliteDatabase, importPgliteDatabase } from "./pglite-transfer";

test("logical transfer preserves binary fields, nullable values, receipts, schema and sequence state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pglite-transfer-"));
  const source = await PGlite.create();
  const destination = await NextPGlite.create({ database: "template1", username: "postgres" });
  const large = Uint8Array.from({ length: 700_000 }, (_, i) => (i * 17) % 251);
  const other = Uint8Array.from({ length: 90_000 }, (_, i) => i % 247);
  const values = { title: "Item 02 ä 😀", nested: [null, false, 1e-100] };
  try {
    await source.exec(`
      create schema fixture;
      create table fixture.records(id bigint primary key, first bytea, second bytea, value jsonb not null);
      create index records_title on fixture.records ((value->>'title'));
      create table fixture.receipts(operation text primary key, record_id bigint references fixture.records(id));
      create sequence fixture.used_sequence start 19;
      create sequence fixture.unused_sequence start 23;
      select nextval('fixture.used_sequence');
    `);
    await source.query("insert into fixture.records values ($1,$2,$3,$4)", ["9007199254740993", large, other, values]);
    await source.query("insert into fixture.records values ($1,$2,$3,$4)", [
      "2",
      null,
      new Uint8Array(),
      { title: "Small" },
    ]);
    await source.query("insert into fixture.records values ($1,$2,$3,$4)", [
      "3",
      new Uint8Array([0, 255, 128]),
      null,
      {},
    ]);
    await source.exec("insert into fixture.receipts values ('original-retry',9007199254740993)");
    await exportPgliteDatabase(source, directory);
    await importPgliteDatabase(destination, directory);
    const read = `select id::text,encode(first,'hex') first,encode(second,'hex') as "second",value from fixture.records order by id`;
    expect((await destination.query(read)).rows).toEqual((await source.query(read)).rows);
    expect((await destination.query("select * from fixture.receipts")).rows).toEqual(
      (await source.query("select * from fixture.receipts")).rows,
    );
    expect(
      (
        await destination.query(
          "select nextval('fixture.used_sequence')::text used,nextval('fixture.unused_sequence')::text unused",
        )
      ).rows,
    ).toEqual([{ used: "20", unused: "23" }]);
    expect(
      (await destination.query("select indexname from pg_indexes where schemaname='fixture' order by indexname")).rows,
    ).toEqual(
      (await source.query("select indexname from pg_indexes where schemaname='fixture' order by indexname")).rows,
    );
    await expect(destination.exec("insert into fixture.receipts values ('original-retry',2)")).rejects.toMatchObject({
      code: "23505",
    });
    await expect(destination.exec("insert into fixture.receipts values ('missing-record',999)")).rejects.toMatchObject({
      code: "23503",
    });
    const files = await readdir(directory);
    const chunkSizes = await Promise.all(
      files.filter((name) => name.endsWith(".copy")).map(async (name) => (await stat(join(directory, name))).size),
    );
    expect(Math.max(...chunkSizes)).toBeLessThan(1_050_000);
    expect(
      (await destination.query("select count(*)::integer count from pg_tables where schemaname like 'pg_temp_%'")).rows,
    ).toEqual([{ count: 0 }]);
  } finally {
    await source.close();
    await destination.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test.each([
  [
    "generated columns",
    "create table unsupported(id integer primary key, value integer, doubled integer generated always as (value*2) stored)",
  ],
  [
    "binary check constraints",
    "create table unsupported(id integer primary key, payload bytea check(octet_length(payload)>0))",
  ],
])("transfer refuses unsupported %s before publishing an archive", async (reason, schema) => {
  const directory = await mkdtemp(join(tmpdir(), "pglite-transfer-schema-"));
  const source = await PGlite.create();
  try {
    await source.exec(schema);
    await expect(exportPgliteDatabase(source, directory)).rejects.toThrow(reason);
    expect(await Bun.file(join(directory, "manifest.json")).exists()).toBe(false);
    expect((await source.query("select count(*)::integer count from unsupported")).rows).toEqual([{ count: 0 }]);
  } finally {
    await source.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("a damaged binary chunk rolls back staging and releases its temporary assembly table", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pglite-transfer-damage-"));
  const source = await PGlite.create();
  const destination = await NextPGlite.create({ database: "template1", username: "postgres" });
  try {
    await source.exec("create table snapshots(id text primary key,state bytea not null)");
    await source.query("insert into snapshots values ('original',$1)", [new Uint8Array(90_000).fill(127)]);
    await exportPgliteDatabase(source, directory);
    const manifest = await Bun.file(join(directory, "manifest.json")).json();
    await Bun.write(join(directory, manifest.tables[0].binary[0].files[0].name), "damaged transfer");
    await expect(importPgliteDatabase(destination, directory)).rejects.toThrow("checksum mismatch");
    expect((await destination.query("select to_regclass('public.snapshots') as table_name")).rows).toEqual([
      { table_name: null },
    ]);
    expect((await source.query("select octet_length(state) length from snapshots")).rows).toEqual([{ length: 90_000 }]);
    expect(
      (await destination.query("select count(*)::integer count from pg_tables where schemaname like 'pg_temp_%'")).rows,
    ).toEqual([{ count: 0 }]);
  } finally {
    await source.close();
    await destination.close();
    await rm(directory, { recursive: true, force: true });
  }
});
