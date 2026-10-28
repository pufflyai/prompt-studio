import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "pglite-previous";
import { createDb } from "./connection.pglite";
import { retiredHomePath } from "./pglite-current-home";
import { engineIdentity } from "./pglite-home-recovery";

test("createDb moves an old home into a JSON-exported backup and starts with a current database", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-retire-"));
  const path = join(root, "pstdio.db");
  try {
    const old = await PGlite.create(path);
    await old.exec("create table projects(id text primary key, name text); insert into projects values ('p1', 'Kept')");
    await old.close();

    const phases: string[] = [];
    const db = await createDb({ path, onPhase: (phase) => phases.push(phase) });
    try {
      expect(phases).toEqual(expect.arrayContaining(["database_retiring", "database_retired", "database_migrated"]));
      expect((await db.pglite.query("select count(*)::int as count from projects")).rows).toEqual([{ count: 0 }]);
    } finally {
      await db.close();
    }
    const [backup] = await readdir(join(root, "backups"));
    expect(backup).toStartWith("pre-0.46-");
    const exported = await readFile(join(root, "backups", backup, "export", "tables", "public.projects.jsonl"), "utf8");
    expect(JSON.parse(exported)).toEqual({ id: "p1", name: "Kept" });
    expect(await readdir(join(root, "backups", backup, "database"))).toContain("PG_VERSION");

    expect(await Bun.file(join(path, ".pstdio-engine.json")).json()).toEqual(engineIdentity);
    expect(phases.filter((phase) => phase === "database_retiring")).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("first creation and symlink opens share one canonical current home", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-runtime-initialize-"));
  const directory = join(root, "homes");
  const parentAlias = join(root, "parent-alias");
  await mkdir(directory);
  await symlink(directory, parentAlias, "junction");
  const path = join(parentAlias, "database");
  try {
    const phases: string[] = [];
    const onPhase = (phase: string) => phases.push(phase);
    const first = await createDb({ path, onPhase });
    try {
      await first.pglite.exec(
        "create collation if not exists exact_locale(provider=icu,locale='sv-SE-u-kn-true-ks-level1',deterministic=false)",
      );
      const labels = ["ä", "z", "a", "Item 10", "Item 2", "ö"];
      const ordered = await first.pglite.query<{ label: string }>(
        "select label from unnest($1::text[]) t(label) order by label collate exact_locale",
        [labels],
      );
      expect(ordered.rows.map(({ label }) => label)).toEqual(
        [...labels].sort(new Intl.Collator("sv-SE", { numeric: true, sensitivity: "base" }).compare),
      );
      expect(first.path).toBe(join(await realpath(directory), "database"));
    } finally {
      await first.close();
    }
    const homeAlias = join(root, "home-alias");
    await symlink(join(directory, "database"), homeAlias, "junction");
    const second = await createDb({ path: homeAlias, onPhase });
    try {
      expect(second.path).toBe(first.path);
      expect(JSON.parse(await readFile(join(homeAlias, ".pstdio-engine.json"), "utf8"))).toEqual(engineIdentity);
    } finally {
      await second.close();
    }
    expect(phases).not.toContain("database_retiring");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a home the export cannot read is still moved aside with the error recorded", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-retire-unreadable-"));
  const path = join(root, "pstdio.db");
  try {
    await mkdir(path);
    await Bun.write(join(path, "notes.txt"), "not a database");
    const db = await createDb({ path });
    await db.close();
    const [backup] = await readdir(join(root, "backups"));
    expect(await Bun.file(join(root, "backups", backup, "export-error.txt")).text()).toContain(
      "Database export worker failed",
    );
    expect(await Bun.file(join(root, "backups", backup, "database", "notes.txt")).text()).toBe("not a database");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a start stopped during the export keeps the old home and leaves no partial backup", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-retire-stopped-"));
  const path = join(root, "pstdio.db");
  try {
    const old = await PGlite.create(path);
    await old.exec("create table projects(id text primary key)");
    await old.close();
    const controller = new AbortController();
    await expect(
      createDb({
        path,
        signal: controller.signal,
        onPhase: (phase) => {
          if (phase === "database_retiring") controller.abort(new Error("quit during export"));
        },
      }),
    ).rejects.toThrow("quit during export");
    expect(await readdir(path)).toContain("PG_VERSION");
    expect(await readdir(join(root, "backups"))).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("homes that share a folder and retire in the same millisecond get separate backups", () => {
  const now = new Date("2026-10-24T11:08:58.776Z");
  expect(retiredHomePath("/home/.pstdio/first", now)).not.toBe(retiredHomePath("/home/.pstdio/second", now));
});
