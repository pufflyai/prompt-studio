import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PGlite as CurrentPGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "pglite-previous";
import { createDb } from "./connection.pglite";

const checkLocale = async (db: Awaited<ReturnType<typeof createDb>>) => {
  await db.pglite.exec(
    "create collation if not exists exact_locale(provider=icu,locale='sv-SE-u-kn-true-ks-level1',deterministic=false)",
  );
  const labels = ["ä", "z", "a", "Item 10", "Item 2", "ö"];
  const ordered = await db.pglite.query<{ label: string }>(
    "select label from unnest($1::text[]) t(label) order by label collate exact_locale",
    [labels],
  );
  expect(ordered.rows.map(({ label }) => label)).toEqual(
    [...labels].sort(new Intl.Collator("sv-SE", { numeric: true, sensitivity: "base" }).compare),
  );
};

// The fixed workload takes 4.5-4.9 s on Linux CI. The user approved 15 s, the existing Windows allowance.
test("createDb upgrades a closed legacy home and preserves records, retry receipts and later writes", async () => {
  const started = performance.now();
  const phase = (name: string) =>
    console.info(`[engine upgrade] ${name} +${Math.round(performance.now() - started)}ms`);
  phase("initialize legacy database");
  const root = await mkdtemp(join(tmpdir(), "pglite-runtime-upgrade-"));
  const path = join(root, "database");
  const old = await PGlite.create(path);
  phase("legacy database ready");
  try {
    // Drizzle's query interface is unchanged; this fixture deliberately uses the old engine.
    await migrate(drizzle(old as unknown as CurrentPGlite), {
      migrationsFolder: join(import.meta.dirname, "../../drizzle"),
    });
    await old.exec(
      "create table retained_fixture(id text primary key, payload bytea); insert into retained_fixture values ('original','\\x00ff'); create table retained_receipts(id text primary key); insert into retained_receipts values ('same-operation')",
    );
    await old.exec(
      "create collation retained_locale from \"C\"; create table retained_titles(label text collate retained_locale); insert into retained_titles values ('z'),('ä')",
    );
  } finally {
    await old.close();
    phase("legacy fixture closed");
  }
  try {
    const phases: string[] = [];
    const upgraded = await createDb({
      path,
      onPhase: (name) => {
        phases.push(name);
        phase(name);
      },
    });
    try {
      expect(phases).toEqual([
        "database_locked",
        "database_engine_loaded",
        "database_upgrade_copying",
        "database_upgrade_exporting",
        "database_upgrade_importing",
        "database_opened",
        "database_migrated",
      ]);
      await checkLocale(upgraded);
      expect(
        (await upgraded.pglite.query("select id,encode(payload,'hex') payload from retained_fixture")).rows,
      ).toEqual([{ id: "original", payload: "00ff" }]);
      expect((await upgraded.pglite.query("select * from retained_receipts")).rows).toEqual([{ id: "same-operation" }]);
      expect((await upgraded.pglite.query("select label from retained_titles order by label")).rows).toEqual([
        { label: "z" },
        { label: "ä" },
      ]);
      expect(
        (
          await upgraded.pglite.query(
            "select collation_name from information_schema.columns where table_name='retained_titles' and column_name='label'",
          )
        ).rows,
      ).toEqual([{ collation_name: "retained_locale" }]);
      await upgraded.pglite.exec("insert into retained_fixture values ('later','\\x17ff')");
    } finally {
      await upgraded.close();
      phase("upgraded database closed");
    }
    expect(JSON.parse(await readFile(join(path, ".pstdio-engine.json"), "utf8"))).toEqual({
      format: 1,
      engine: "pglite-0.4",
    });
    const reopenedPhases: string[] = [];
    const reopened = await createDb({
      path,
      onPhase: (name) => {
        reopenedPhases.push(name);
        phase(`restart ${name}`);
      },
    });
    try {
      expect(reopenedPhases.some((name) => name.startsWith("database_upgrade_"))).toBe(false);
      expect((await reopened.pglite.query("select count(*)::int count from retained_fixture")).rows).toEqual([
        { count: 2 },
      ]);
    } finally {
      await reopened.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);

test("first creation and symlink opens share one canonical current-engine home", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-runtime-initialize-"));
  const directory = join(root, "homes");
  const parentAlias = join(root, "parent-alias");
  await mkdir(directory);
  await symlink(directory, parentAlias, "junction");
  const path = join(parentAlias, "database");
  try {
    const first = await createDb({ path });
    try {
      await checkLocale(first);
      expect(first.path).toBe(join(await realpath(directory), "database"));
    } finally {
      await first.close();
    }
    const homeAlias = join(root, "home-alias");
    await symlink(join(directory, "database"), homeAlias, "junction");
    const second = await createDb({ path: homeAlias });
    try {
      expect(second.path).toBe(first.path);
      expect(JSON.parse(await readFile(join(homeAlias, ".pstdio-engine.json"), "utf8"))).toEqual({
        format: 1,
        engine: "pglite-0.4",
      });
    } finally {
      await second.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
