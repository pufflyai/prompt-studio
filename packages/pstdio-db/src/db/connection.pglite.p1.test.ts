import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEnvironmentDBService } from "../services/environment/environment";
import { createDb, resolvePgliteOptions } from "./connection.pglite";

const originalDbPath = process.env.PSTDIO_DB_PATH;
// ADR 0044: creating an on-disk database writes about a thousand PostgreSQL files. Windows CI
// runners take 2–4 s for that and have spiked to 11 s, past Bun's 5 s default. Temporary limit.
const windowsDiskLimit = process.platform === "win32" ? 15_000 : undefined;

const createTempDbPath = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-lock-"));
  const dbPath = path.join(tempRoot, "database");
  fs.mkdirSync(dbPath);
  return { dbPath, tempRoot };
};

afterEach(() => {
  if (typeof originalDbPath === "undefined") {
    delete process.env.PSTDIO_DB_PATH;
    return;
  }

  process.env.PSTDIO_DB_PATH = originalDbPath;
});

for (const storage of ["memory", "disk"])
  it(
    `creates the final 30-table schema in a fresh ${storage} database`,
    async () => {
      const { dbPath, tempRoot } = createTempDbPath();
      let client: Awaited<ReturnType<typeof createDb>> | undefined;
      try {
        client = await createDb({ path: storage === "memory" ? ":memory:" : dbPath });
        const { rows } = await client.pglite.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'",
        );
        expect(rows).toEqual([{ count: 30 }]);
      } finally {
        await client?.close();
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    windowsDiskLimit,
  );

it(
  "restores durable upgrade input when the active database needs a fresh image",
  async () => {
    const { dbPath, tempRoot } = createTempDbPath();
    const snapshot = `${dbPath}-app-preferences-upgrade.json`;
    fs.writeFileSync(snapshot, JSON.stringify({ environmentId: "retained-device" }));
    let client: Awaited<ReturnType<typeof createDb>> | undefined;
    try {
      client = await createDb({ path: dbPath });
      expect(await createEnvironmentDBService(client.db).get()).toEqual({ environmentId: "retained-device" });
      expect(fs.existsSync(snapshot)).toBe(false);
      await client.close();
      client = await createDb({ path: dbPath });
      expect(await createEnvironmentDBService(client.db).get()).toEqual({ environmentId: "retained-device" });
    } finally {
      await client?.close();
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  windowsDiskLimit,
);

describe("createDb", () => {
  // Sequential lock checks leave database contents unchanged. Sharing the directory
  // avoids copying over a thousand PostgreSQL files while every test owns its connections.
  let seed: ReturnType<typeof createTempDbPath>;

  beforeAll(async () => {
    seed = createTempDbPath();
    const client = await createDb({ path: seed.dbPath });
    await client.close();
  }, windowsDiskLimit);

  afterAll(() => fs.rmSync(seed.tempRoot, { recursive: true, force: true }));

  it(
    "uses PSTDIO_DB_PATH for the default database location",
    async () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-"));
      const dbPath = path.join(tempRoot, ".pstdio");

      process.env.PSTDIO_DB_PATH = dbPath;

      const started = performance.now();
      const phase = (name: string) =>
        console.info(`Default database fixture: ${name} +${Math.round(performance.now() - started)}ms`);
      phase("starting");
      const client = await createDb({ onPhase: phase });
      phase("created");

      expect(client.path).toBe(fs.realpathSync.native(dbPath));
      expect(fs.existsSync(dbPath)).toBe(true);

      await client.close();
      phase("closed");
      fs.rmSync(tempRoot, { force: true, recursive: true });
      phase("removed");
    },
    windowsDiskLimit,
  );

  it("refuses to open a database directory held by a live process", async () => {
    const { dbPath } = seed;
    const first = await createDb({ path: dbPath });

    try {
      await expect(createDb({ path: dbPath })).rejects.toThrow(
        /pstdio\.db is in use .*refusing to open it a second time/,
      );
    } finally {
      await first.close();
    }
  });

  it("allows a database directory to be reopened after close", async () => {
    const { dbPath } = seed;
    const first = await createDb({ path: dbPath });
    await first.close();

    const second = await createDb({ path: dbPath });
    try {
      const result = await second.pglite.query("SELECT 1 AS ready");
      expect(result.rows).toEqual([{ ready: 1 }]);
    } finally {
      await second.close();
    }
  });

  it("refuses a symlink alias while the canonical database directory is open", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-alias-"));
    const { dbPath } = seed;
    const aliasPath = path.join(tempRoot, "database-alias");
    fs.symlinkSync(dbPath, aliasPath, "junction");
    const first = await createDb({ path: dbPath });

    try {
      await expect(createDb({ path: aliasPath })).rejects.toThrow(/pstdio\.db is in use/);
    } finally {
      await first.close();
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});

describe("resolvePgliteOptions", () => {
  const toEmbedded = (name: string, content: Uint8Array) => ({
    name,
    size: content.byteLength,
    arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  });

  // Minimal valid WebAssembly module bytes — magic header + version
  const EMPTY_WASM = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

  it("loads full locale data and the explicit database identity in source mode", async () => {
    const opts = await resolvePgliteOptions([]);
    expect(opts.database).toBe("template1");
    expect(opts.username).toBe("postgres");
    expect(opts.icuDataDir.size).toBeGreaterThan(0);
  });

  it("loads the embedded engine and initial database image", async () => {
    const wasmFile = toEmbedded("../../pstdio-db/vendor/pglite/pglite.wasm", EMPTY_WASM);
    const dataFile = toEmbedded("../../pstdio-db/vendor/pglite/pglite.data", new Uint8Array([1, 2, 3]));
    const initialDatabase = toEmbedded("../../pstdio-db/vendor/pglite/initial-database.tar.gz", new Uint8Array([4]));
    const icu = toEmbedded("../../pstdio-db/vendor/pglite/icu.76.tgz", new Uint8Array([5]));

    const opts = (await resolvePgliteOptions([
      wasmFile as never,
      dataFile as never,
      initialDatabase as never,
      icu as never,
    ])) as {
      fsBundle: typeof dataFile;
      pgliteWasmModule: WebAssembly.Module;
      loadDataDir: typeof initialDatabase;
    };

    expect(opts.fsBundle).toBe(dataFile);
    expect(opts.pgliteWasmModule).toBeInstanceOf(WebAssembly.Module);
    expect(opts.loadDataDir).toBe(initialDatabase);
  });

  it("recognizes Windows-style embedded PGlite asset names", async () => {
    const wasmFile = toEmbedded("..\\..\\pstdio-db\\vendor\\pglite\\pglite.wasm", EMPTY_WASM);
    const dataFile = toEmbedded("..\\..\\pstdio-db\\vendor\\pglite\\pglite.data", new Uint8Array([1, 2, 3]));
    const initialDatabase = toEmbedded(
      "..\\..\\pstdio-db\\vendor\\pglite\\initial-database.tar.gz",
      new Uint8Array([4]),
    );
    const icu = toEmbedded("..\\..\\pstdio-db\\vendor\\pglite\\icu.76.tgz", new Uint8Array([5]));

    const opts = (await resolvePgliteOptions([
      wasmFile as never,
      dataFile as never,
      initialDatabase as never,
      icu as never,
    ])) as {
      fsBundle: typeof dataFile;
      pgliteWasmModule: WebAssembly.Module;
      loadDataDir: typeof initialDatabase;
    };

    expect(opts.fsBundle).toBe(dataFile);
    expect(opts.pgliteWasmModule).toBeInstanceOf(WebAssembly.Module);
    expect(opts.loadDataDir).toBe(initialDatabase);
  });

  it("rejects an incomplete embedded database runtime", async () => {
    const wasmFile = toEmbedded("../../pstdio-db/vendor/pglite/pglite.wasm", EMPTY_WASM);
    await expect(resolvePgliteOptions([wasmFile as never])).rejects.toThrow(/Partial PGlite embed/);
  });
});
