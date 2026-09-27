import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, unlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openPglite } from "./open-pglite";

let image: Blob;
let existingHome: string;
const homes: string[] = [];
const tracePhase = (phase: string, startedAt: number) => {
  if (process.platform === "win32") {
    process.stderr.write(`[open-pglite] ${phase}: ${(performance.now() - startedAt).toFixed(1)}ms\n`);
  }
};
const createHome = () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-bootstrap-db-"));
  homes.push(home);
  return home;
};

beforeAll(async () => {
  const startedAt = performance.now();
  tracePhase("seed start", startedAt);
  existingHome = mkdtempSync(join(tmpdir(), "pstdio-bootstrap-seed-"));
  const source = await PGlite.create();
  tracePhase("seed engine ready", startedAt);
  try {
    await source.exec("CREATE TABLE bootstrap_probe (value text); INSERT INTO bootstrap_probe VALUES ('image');");
    image = await source.dumpDataDir("gzip");
    tracePhase("seed image ready", startedAt);
    await source.exec("UPDATE bootstrap_probe SET value = 'user data';");
    // Materialize a closed disk fixture without bootstrapping PostgreSQL on disk.
    const existing = await PGlite.create(existingHome, { loadDataDir: await source.dumpDataDir("none") });
    tracePhase("seed disk ready", startedAt);
    await existing.close();
  } finally {
    await source.close();
    tracePhase("seed complete", startedAt);
  }
});

// Release each test's database before the next one creates another file tree.
afterEach(async () => {
  for (const home of homes.splice(0)) {
    const startedAt = performance.now();
    tracePhase("remove start", startedAt);
    await rm(home, { recursive: true, force: true });
    tracePhase("remove complete", startedAt);
  }
});

afterAll(() => rm(existingHome, { recursive: true, force: true }));

test("initializes an empty database directory from its packaged image", async () => {
  const startedAt = performance.now();
  tracePhase("open start", startedAt);
  const db = openPglite(createHome(), { loadDataDir: image });
  try {
    expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "image" }]);
    tracePhase("query complete", startedAt);
  } finally {
    const closeStartedAt = performance.now();
    tracePhase("close start", closeStartedAt);
    await db.close();
    tracePhase("close complete", closeStartedAt);
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
  // Copy a closed database so this case tests reopen behavior without another bootstrap.
  cpSync(existingHome, home, { recursive: true });
  const db = openPglite(home, { loadDataDir: image });
  try {
    expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "user data" }]);
  } finally {
    if (!db.closed) await db.close().catch(() => {});
  }
});

test("leaves a damaged database intact instead of replacing it with the packaged image", async () => {
  const home = createHome();
  cpSync(existingHome, home, { recursive: true });
  const versionPath = join(home, "PG_VERSION");
  const version = readFileSync(versionPath);
  unlinkSync(join(home, "global", "pg_control"));
  const db = openPglite(home, { loadDataDir: image });
  await expect(db.waitReady).rejects.toThrow();
  expect(readFileSync(versionPath)).toEqual(version);
});
