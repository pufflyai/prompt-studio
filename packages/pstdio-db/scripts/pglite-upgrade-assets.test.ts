import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite as NextPGlite } from "@electric-sql/pglite";
import { PGlite } from "pglite-previous";
import { resolveUpgradeWorker } from "../src/db/pglite-upgrade-assets";
import { buildPgliteUpgradeAssets } from "./pglite-upgrade-assets";

test("vendored transfer workers run outside the repository and retain full locale data", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-upgrade-worker-"));
  try {
    const assets = join(root, "assets");
    await buildPgliteUpgradeAssets(assets);
    const embedded = [...new Bun.Glob("**/*").scanSync({ cwd: assets, onlyFiles: true })].map(
      (name) => new File([Bun.file(join(assets, name))], `../../pstdio-db/vendor/${name}`),
    );
    const worker = await resolveUpgradeWorker(embedded);
    await rm(assets, { recursive: true });
    try {
      const source = join(root, "source");
      const old = await PGlite.create(source);
      await old.exec(
        "create table retained(id text primary key,payload bytea not null);insert into retained values ('original',decode('00ff1180','hex'))",
      );
      await old.close();
      const archive = join(root, "archive");
      const destination = join(root, "destination");
      const run = async (phase: string, database: string) => {
        const child = Bun.spawn([process.execPath, worker.entry, phase, database, archive, worker.assets!], {
          cwd: root,
          env: { ...process.env, BUN_BE_BUN: "1" },
          stdout: "pipe",
          stderr: "pipe",
        });
        const [out, error, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        expect({ code, error, out }).toMatchObject({ code: 0 });
      };
      await run("export", source);
      await run("import", destination);
      const next = await NextPGlite.create(destination, {
        database: "template1",
        username: "postgres",
        icuDataDir: Bun.file(join(worker.assets!, "pglite/icu.76.tgz")),
      });
      try {
        expect((await next.query("select id,encode(payload,'hex') bytes from retained")).rows).toEqual([
          { id: "original", bytes: "00ff1180" },
        ]);
        expect((await next.query("select datname from pg_database")).rows).toEqual([{ datname: "template1" }]);
        await next.exec(
          "create collation checked_locale(provider=icu,locale='sv-SE-u-kn-true-ks-level1',deterministic=false)",
        );
        const labels = ["ä", "z", "a", "Item 10", "Item 2", "ö"];
        const actual = await next.query<{ label: string }>(
          "select label from unnest($1::text[]) as t(label) order by label collate checked_locale",
          [labels],
        );
        expect(actual.rows.map(({ label }) => label)).toEqual(
          [...labels].sort(new Intl.Collator("sv-SE", { numeric: true, sensitivity: "base" }).compare),
        );
      } finally {
        await next.close();
      }
    } finally {
      await worker.dispose();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  // Builds the assets and boots PGlite in three processes; 15 s approved by the user on 2026-10-23.
}, 15_000);
