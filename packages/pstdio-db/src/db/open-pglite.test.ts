import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openPglite } from "./open-pglite";

let image: Blob;
const homes: string[] = [];
const createHome = () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-bootstrap-db-"));
  homes.push(home);
  return home;
};

beforeAll(async () => {
  const source = await PGlite.create();
  try {
    await source.exec("CREATE TABLE bootstrap_probe (value text); INSERT INTO bootstrap_probe VALUES ('image');");
    image = await source.dumpDataDir("gzip");
  } finally {
    await source.close();
  }
});

afterAll(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
});

test("initializes an empty database directory from its packaged image", async () => {
  const db = openPglite(createHome(), { loadDataDir: image });
  try {
    expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "image" }]);
  } finally {
    await db.close();
  }
});

test("initializes an in-memory database from its packaged image", async () => {
  const db = openPglite(":memory:", { loadDataDir: image });
  try {
    expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "image" }]);
  } finally {
    await db.close();
  }
});

test("preserves existing database records when a packaged image is available", async () => {
  const home = createHome();
  const existing = await PGlite.create(home);
  await existing.exec("CREATE TABLE bootstrap_probe (value text); INSERT INTO bootstrap_probe VALUES ('user data');");
  await existing.close();
  const db = openPglite(home, { loadDataDir: image });
  try {
    expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "user data" }]);
  } finally {
    if (!db.closed) await db.close().catch(() => {});
  }
});

test("leaves a damaged database intact instead of replacing it with the packaged image", async () => {
  const home = createHome();
  const existing = await PGlite.create(home);
  await existing.close();
  const versionPath = join(home, "PG_VERSION");
  const version = readFileSync(versionPath);
  unlinkSync(join(home, "global", "pg_control"));
  const db = openPglite(home, { loadDataDir: image });
  await expect(db.waitReady).rejects.toThrow();
  expect(readFileSync(versionPath)).toEqual(version);
});
