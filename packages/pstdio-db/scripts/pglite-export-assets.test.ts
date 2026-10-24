import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite as CurrentPGlite } from "@electric-sql/pglite";
import { PGlite } from "pglite-previous";
import { resolveExportWorker } from "../src/db/pglite-export-assets";
import { buildPgliteExportAssets } from "./pglite-export-assets";

test("the vendored export worker reads homes from both engines outside the repository", async () => {
  const root = await mkdtemp(join(tmpdir(), "pglite-export-worker-"));
  try {
    const assets = join(root, "assets");
    await buildPgliteExportAssets(assets);
    const embedded = [...new Bun.Glob("**/*").scanSync({ cwd: assets, onlyFiles: true })].map(
      (name) => new File([Bun.file(join(assets, name))], `../../pstdio-db/vendor/${name}`),
    );
    const worker = await resolveExportWorker(embedded);
    await rm(assets, { recursive: true });
    try {
      const previous = join(root, "previous");
      const old = await PGlite.create(previous);
      await old.exec("create table retained(id text primary key, payload bytea not null)");
      await old.exec("insert into retained values ('previous', decode('00ff', 'hex'))");
      await old.close();
      // A 0.46 nightly home: the current engine, marked, but written before the baseline.
      const nightly = join(root, "nightly");
      const current = await CurrentPGlite.create(nightly);
      await current.exec("create table retained(id text primary key, payload bytea not null)");
      await current.exec("insert into retained values ('nightly', decode('1180', 'hex'))");
      await current.close();
      await Bun.write(join(nightly, ".pstdio-engine.json"), JSON.stringify({ format: 1, engine: "pglite-0.4" }));

      for (const [home, expected] of [
        [previous, { id: "previous", payload: "\\x00ff" }],
        [nightly, { id: "nightly", payload: "\\x1180" }],
      ] as const) {
        const output = `${home}-export`;
        const child = Bun.spawn([process.execPath, worker.entry, home, output, worker.assets!], {
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
        expect(await Bun.file(join(output, "tables", "public.retained.jsonl")).json()).toEqual(expected);
      }
    } finally {
      await worker.dispose();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
