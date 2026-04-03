import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createDb, resolveMigrationsFolder } from "./connection.pglite";

const originalDbPath = process.env.PSTDIO_DB_PATH;

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

    expect(client.path).toBe(dbPath);
    expect(fs.existsSync(dbPath)).toBe(true);

    await client.close();
    fs.rmSync(tempRoot, { force: true, recursive: true });
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
