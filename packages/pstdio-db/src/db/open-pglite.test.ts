import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { openPglite } from "./open-pglite";

// ADR 0044: these disk fixtures create and remove about a thousand PostgreSQL files.
// Windows runner variance exceeded 5 s; use the approved 15 s disk-test limit.
const windowsDiskLimit = process.platform === "win32" ? 15_000 : undefined;

let image: Blob;
let existingHome: string;
const homes: string[] = [];
const createHome = () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-bootstrap-db-"));
  homes.push(home);
  return home;
};

beforeAll(async () => {
  existingHome = mkdtempSync(join(tmpdir(), "pstdio-bootstrap-seed-"));
  const source = await PGlite.create();
  try {
    await source.exec("CREATE TABLE bootstrap_probe (value text); INSERT INTO bootstrap_probe VALUES ('image');");
    image = await source.dumpDataDir("gzip");
    await source.exec("UPDATE bootstrap_probe SET value = 'user data';");
    // Materialize a closed disk fixture without bootstrapping PostgreSQL on disk.
    const existing = await PGlite.create(existingHome, { loadDataDir: await source.dumpDataDir("none") });
    await existing.close();
  } finally {
    await source.close();
  }
}, windowsDiskLimit);

// Release each test's database before the next one creates another file tree.
afterEach(async () => {
  for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true });
}, windowsDiskLimit);

afterAll(() => rm(existingHome, { recursive: true, force: true }), windowsDiskLimit);

test(
  "initializes an empty database directory from its packaged image",
  async () => {
    const db = await openPglite(createHome(), { loadDataDir: image });
    try {
      expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "image" }]);
    } finally {
      await db.close();
    }
  },
  windowsDiskLimit,
);

test("initializes an in-memory database from its packaged image", async () => {
  const db = await openPglite(":memory:", { loadDataDir: image });
  try {
    expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "image" }]);
  } finally {
    await db.close();
  }
});

test(
  "preserves existing database records when a packaged image is available",
  async () => {
    const home = createHome();
    // Copy a closed database so this case tests reopen behavior without another bootstrap.
    cpSync(existingHome, home, { recursive: true });
    const db = await openPglite(home, { loadDataDir: image });
    try {
      expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "user data" }]);
    } finally {
      if (!db.closed) await db.close().catch(() => {});
    }
  },
  windowsDiskLimit,
);

test(
  "leaves a damaged database intact instead of replacing it with the packaged image",
  async () => {
    const home = createHome();
    cpSync(existingHome, home, { recursive: true });
    const versionPath = join(home, "PG_VERSION");
    const version = readFileSync(versionPath);
    unlinkSync(join(home, "global", "pg_control"));
    const db = await openPglite(home, { loadDataDir: image });
    await expect(db.waitReady).rejects.toThrow();
    expect(readFileSync(versionPath)).toEqual(version);
  },
  windowsDiskLimit,
);

test(
  "finishes a first start that was killed while it unpacked the packaged image",
  async () => {
    const root = createHome();
    const home = join(root, "pstdio.db");
    mkdirSync(home);
    const imagePath = join(createHome(), "initial-database.tar.gz");
    writeFileSync(imagePath, new Uint8Array(await image.arrayBuffer()));
    const firstStart = Bun.spawn([
      process.execPath,
      "-e",
      `
        import { openPglite } from ${JSON.stringify(join(import.meta.dirname, "open-pglite.ts"))};
        const [home, imagePath] = process.argv.slice(1);
        const image = new Blob([await Bun.file(imagePath).bytes()], { type: "application/gzip" });
        await (await openPglite(home, { loadDataDir: image })).waitReady;
      `,
      home,
      imagePath,
    ]);
    // Stop the first start as soon as it writes database files, like a desktop startup timeout would.
    while (readdirSync(root, { recursive: true }).length < 2 && firstStart.exitCode === null) await Bun.sleep(1);
    expect(firstStart.exitCode).toBeNull();
    firstStart.kill("SIGKILL");
    await firstStart.exited;
    // The stopped start must not leave a partial database where the next start looks for one.
    expect(readdirSync(home)).toEqual([]);

    const db = await openPglite(home, { loadDataDir: image });
    try {
      expect((await db.query("SELECT value FROM bootstrap_probe")).rows).toEqual([{ value: "image" }]);
    } finally {
      if (!db.closed) await db.close().catch(() => {});
    }
  },
  windowsDiskLimit,
);
