import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createDb, resolveMigrationsFolder, resolvePgliteOptions } from "./connection.pglite";
import * as schema from "./schemas.pg";

const originalDbPath = process.env.PSTDIO_DB_PATH;

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

describe("createDb", () => {
  it("creates in-memory databases without migration files", async () => {
    const client = await createDb({ path: ":memory:" });

    expect(client.path).toBe(":memory:");

    await client.close();
  });

  it("uses PSTDIO_DB_PATH for the default database location", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-"));
    const dbPath = path.join(tempRoot, ".pstdio");

    process.env.PSTDIO_DB_PATH = dbPath;

    const client = await createDb();

    expect(client.path).toBe(fs.realpathSync(dbPath));
    expect(fs.existsSync(dbPath)).toBe(true);

    await client.close();
    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("refuses to open a database directory held by a live process", async () => {
    const { dbPath, tempRoot } = createTempDbPath();
    const first = await createDb({ path: dbPath });

    try {
      await expect(createDb({ path: dbPath })).rejects.toThrow(
        new RegExp(`pstdio\\.db is in use by pid ${process.pid} .*refusing to open it a second time`),
      );
    } finally {
      await first.close();
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it("allows a database directory to be reopened after close", async () => {
    const { dbPath, tempRoot } = createTempDbPath();
    const first = await createDb({ path: dbPath });
    await first.close();

    const second = await createDb({ path: dbPath });
    await second.close();

    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("reclaims a lock owned by a dead process", async () => {
    const { dbPath, tempRoot } = createTempDbPath();
    const lockPath = `${dbPath}.lock`;
    fs.writeFileSync(
      lockPath,
      JSON.stringify({ pid: 999_999_999, process: "stopped pstdio serve", startedAt: "2026-07-15T10:00:00.000Z" }),
    );

    const client = await createDb({ path: dbPath });
    await client.close();

    expect(fs.statSync(lockPath).isDirectory()).toBe(true);
    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("refuses a symlink alias while the canonical database directory is open", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-alias-"));
    const dbPath = path.join(tempRoot, "database");
    const aliasPath = path.join(tempRoot, "database-alias");
    fs.mkdirSync(dbPath);
    fs.symlinkSync(dbPath, aliasPath);
    const first = await createDb({ path: dbPath });

    try {
      await expect(createDb({ path: aliasPath })).rejects.toThrow(
        new RegExp(`pstdio\\.db is in use by pid ${process.pid}`),
      );
    } finally {
      await first.close();
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it("reclaims an incomplete lock left without owner metadata", async () => {
    const { dbPath, tempRoot } = createTempDbPath();
    const lockPath = `${dbPath}.lock`;
    fs.writeFileSync(lockPath, "");

    const client = await createDb({ path: dbPath });
    await client.close();

    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("upgrades a pre-extension-storage template into readable extension storage", async () => {
    const { dbPath, tempRoot } = createTempDbPath();
    const pglite = new PGlite(dbPath);
    await pglite.waitReady;
    const oldDb = drizzle(pglite, { schema });
    const migrationsFolder = await resolveMigrationsFolder();
    const oldMigrationsFolder = path.join(tempRoot, "old-migrations");
    fs.mkdirSync(path.join(oldMigrationsFolder, "meta"), { recursive: true });
    const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    journal.entries = journal.entries.slice(0, 11);
    fs.writeFileSync(path.join(oldMigrationsFolder, "meta/_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries) {
      fs.copyFileSync(
        path.join(migrationsFolder, `${entry.tag}.sql`),
        path.join(oldMigrationsFolder, `${entry.tag}.sql`),
      );
    }
    await migrate(oldDb, { migrationsFolder: oldMigrationsFolder });
    await pglite.exec(`
      INSERT INTO projects
        (id, name, shorthand, created_at, updated_at, selected_agents)
      VALUES
        ('project-1', 'Legacy project', 'LEG', '2026-01-01', '2026-01-01', '[]');
      INSERT INTO files
        (id, project_id, file_name, file_kind, storage_path, mime_type, size_bytes, hash, created_at, updated_at)
      VALUES
        ('file-1', 'project-1', 'implement_ticket.md', 'template', '/legacy/implement_ticket.md',
         'text/markdown', 14, 'legacy-hash', '2026-01-01', '2026-01-01');
      INSERT INTO templates
        (id, project_id, name, template_type, file_id, is_default, created_at, updated_at, deleted_at)
      VALUES
        ('template-1', 'project-1', 'implement_ticket', 'prompt', 'file-1', true,
         '2026-01-01', '2026-01-01', NULL);
    `);
    await pglite.close();

    const current = await createDb({ path: dbPath });
    const templates = await current.pglite.query<{
      extension_instance_id: string;
      item_id: string;
      value_json: { blobId: string; type: string };
    }>(
      `SELECT extension_instance_id, item_id, value_json
         FROM extension_collection_items
        WHERE collection = 'templates'`,
    );
    expect(templates.rows).toEqual([
      {
        extension_instance_id: expect.any(String),
        item_id: "implement-ticket",
        value_json: expect.objectContaining({ blobId: "file-1", type: "prompt" }),
      },
    ]);
    const linkedFile = await current.pglite.query<{ storage_path: string }>(
      `SELECT files.storage_path
         FROM extension_files
         JOIN files ON files.id = extension_files.file_id`,
    );
    expect(linkedFile.rows).toEqual([{ storage_path: "/legacy/implement_ticket.md" }]);
    const legacyTable = await current.pglite.query<{ name: string | null }>(
      "SELECT to_regclass('public.templates')::text AS name",
    );
    expect(legacyTable.rows).toEqual([{ name: null }]);

    await current.close();

    fs.rmSync(tempRoot, { force: true, recursive: true });
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

  it("returns no overrides when no PGlite assets are embedded (source mode)", async () => {
    const opts = await resolvePgliteOptions([]);
    expect(opts).toEqual({});
  });

  it("compiles wasm and returns the data Blob when both assets are embedded", async () => {
    const wasmFile = toEmbedded("../../pstdio-db/vendor/pglite/pglite.wasm", EMPTY_WASM);
    const dataFile = toEmbedded("../../pstdio-db/vendor/pglite/pglite.data", new Uint8Array([1, 2, 3]));

    const opts = (await resolvePgliteOptions([wasmFile as never, dataFile as never])) as {
      fsBundle: typeof dataFile;
      wasmModule: WebAssembly.Module;
    };

    expect(opts.fsBundle).toBe(dataFile);
    expect(opts.wasmModule).toBeInstanceOf(WebAssembly.Module);
  });

  it("recognizes Windows-style embedded PGlite asset names", async () => {
    const wasmFile = toEmbedded("..\\..\\pstdio-db\\vendor\\pglite\\pglite.wasm", EMPTY_WASM);
    const dataFile = toEmbedded("..\\..\\pstdio-db\\vendor\\pglite\\pglite.data", new Uint8Array([1, 2, 3]));

    const opts = (await resolvePgliteOptions([wasmFile as never, dataFile as never])) as {
      fsBundle: typeof dataFile;
      wasmModule: WebAssembly.Module;
    };

    expect(opts.fsBundle).toBe(dataFile);
    expect(opts.wasmModule).toBeInstanceOf(WebAssembly.Module);
  });

  it("throws when only one of the two PGlite assets is embedded", async () => {
    const wasmFile = toEmbedded("../../pstdio-db/vendor/pglite/pglite.wasm", EMPTY_WASM);
    await expect(resolvePgliteOptions([wasmFile as never])).rejects.toThrow(/Partial PGlite embed/);
  });
});

describe("resolveMigrationsFolder", () => {
  const toEmbedded = (name: string, content: string) => ({
    name: `../../pstdio-db/drizzle/${name}`,
    size: content.length,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  });

  it("extracts all embedded migrations to disk", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-migrations-"));
    const extractionRoot = path.join(tempRoot, "pstdio-drizzle");

    const journal = '{"version":"7","entries":[{"idx":0,"tag":"0000_lush_corsair"}]}';

    await resolveMigrationsFolder({
      tmpDir: tempRoot,
      embeddedFiles: [toEmbedded("0000_lush_corsair.sql", "-- migration"), toEmbedded("meta/_journal.json", journal)],
      logger: () => {},
    });

    expect(fs.existsSync(path.join(extractionRoot, "0000_lush_corsair.sql"))).toBe(true);
    expect(fs.existsSync(path.join(extractionRoot, "meta", "_journal.json"))).toBe(true);

    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("extracts migrations with Windows-style embedded names", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-migrations-windows-"));
    const embedded = toEmbedded("0000_lush_corsair.sql", "-- migration");
    embedded.name = embedded.name.replaceAll("/", "\\");

    try {
      const folder = await resolveMigrationsFolder({
        tmpDir: tempRoot,
        embeddedFiles: [embedded],
        logger: () => {},
      });

      expect(folder).toBe(path.join(tempRoot, "pstdio-drizzle"));
      expect(fs.existsSync(path.join(folder, "0000_lush_corsair.sql"))).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it("cleans up stale files from previous extractions", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-migrations-"));
    const extractionRoot = path.join(tempRoot, "pstdio-drizzle");

    // Simulate leftover from an older binary
    fs.mkdirSync(extractionRoot, { recursive: true });
    fs.writeFileSync(path.join(extractionRoot, "0000_old.sql"), "-- stale");

    await resolveMigrationsFolder({
      tmpDir: tempRoot,
      embeddedFiles: [
        toEmbedded("0001_new.sql", "-- new migration"),
        toEmbedded("meta/_journal.json", '{"version":"7"}'),
      ],
      logger: () => {},
    });

    expect(fs.existsSync(path.join(extractionRoot, "0000_old.sql"))).toBe(false);
    expect(fs.existsSync(path.join(extractionRoot, "0001_new.sql"))).toBe(true);

    fs.rmSync(tempRoot, { force: true, recursive: true });
  });
});
