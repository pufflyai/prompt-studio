import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGlite as NextPGlite } from "pglite-next";
import { preparePgliteHome } from "./pglite-home-recovery";
import { acquirePgliteLock } from "./pglite-lock";
import { exportPgliteDatabase, importPgliteDatabase } from "./pglite-transfer";

test("a closed imported database survives interrupted publication and later committed writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pglite-home-database-"));
  const activePath = join(directory, "database");
  const engine = { database: "template1", username: "postgres" };
  const release = acquirePgliteLock(activePath);
  try {
    const old = await PGlite.create(activePath);
    try {
      await old.exec(
        "create table records(id text primary key, value bytea); insert into records values ('original','\\x00ff'); create table receipts(id text primary key); insert into receipts values ('retry-identity')",
      );
    } finally {
      await old.close();
    }
    const prepare = async ({ source, target, work }: { source?: string; target: string; work: string }) => {
      if (!source) throw new Error("Expected existing home");
      const copy = join(work, "source");
      const archive = join(work, "archive");
      await cp(source, copy, { recursive: true });
      await mkdir(archive);
      const exporter = await PGlite.create(copy);
      try {
        await exportPgliteDatabase(exporter, archive);
      } finally {
        await exporter.close();
      }
      const importer = await NextPGlite.create(target, engine);
      try {
        await importPgliteDatabase(importer, archive);
        expect((await importer.query("select id,encode(value,'hex') value from records")).rows).toEqual([
          { id: "original", value: "00ff" },
        ]);
        expect((await importer.query("select * from receipts")).rows).toEqual([{ id: "retry-identity" }]);
      } finally {
        await importer.close();
      }
    };
    const unexpectedPreparation = async () => {
      throw new Error("A verified or active home must not be prepared again");
    };
    await expect(
      preparePgliteHome({
        activePath,
        prepare,
        onPhase: (phase) => {
          if (phase === "original-moved") throw new Error("interrupted publication");
        },
      }),
    ).rejects.toThrow("interrupted publication");
    await preparePgliteHome({ activePath, prepare: unexpectedPreparation });
    const reopened = await NextPGlite.create(activePath, engine);
    try {
      expect((await reopened.query("select * from receipts")).rows).toEqual([{ id: "retry-identity" }]);
      await reopened.exec("insert into records values ('later','\\x1700')");
    } finally {
      await reopened.close();
    }
    await preparePgliteHome({ activePath, prepare: unexpectedPreparation });
    const final = await NextPGlite.create(activePath, engine);
    try {
      expect((await final.query("select id,encode(value,'hex') value from records order by id")).rows).toEqual([
        { id: "later", value: "1700" },
        { id: "original", value: "00ff" },
      ]);
    } finally {
      await final.close();
    }
  } finally {
    release();
    await rm(directory, { recursive: true, force: true });
  }
});
