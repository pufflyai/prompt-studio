import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveMigrationsFolder } from "./migrations-folder";

const toEmbedded = (name: string, content: string) => ({
  name: `../../pstdio-db/drizzle/${name}`,
  size: content.length,
  arrayBuffer: async () => new TextEncoder().encode(content).buffer,
});

describe("packaged migration extraction", () => {
  test("keeps simultaneous extractions separate without deleting another runtime's files", async () => {
    const home = mkdtempSync(join(tmpdir(), "pstdio-migrations-"));
    try {
      const first = await resolveMigrationsFolder({
        homePath: home,
        embeddedFiles: [toEmbedded("0000_first.sql", "-- first")],
        logger: () => {},
      });
      const second = await resolveMigrationsFolder({
        homePath: home,
        embeddedFiles: [toEmbedded("0000_second.sql", "-- second")],
        logger: () => {},
      });
      expect(second.path).not.toBe(first.path);
      expect(first.path.startsWith(join(home, "pstdio-drizzle-"))).toBe(true);
      expect(readFileSync(join(first.path, "0000_first.sql"), "utf8")).toBe("-- first");
      expect(existsSync(join(second.path, "0000_first.sql"))).toBe(false);
      if (process.platform !== "win32") {
        expect(statSync(first.path).mode & 0o777).toBe(0o700);
        expect(statSync(join(first.path, "0000_first.sql")).mode & 0o777).toBe(0o600);
      }
      first.cleanup();
      expect(existsSync(first.path)).toBe(false);
      expect(readFileSync(join(second.path, "0000_second.sql"), "utf8")).toBe("-- second");
      second.cleanup();
      expect(readdirSync(home)).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("extracts the journal and Windows-style embedded names", async () => {
    const home = mkdtempSync(join(tmpdir(), "pstdio-migrations-"));
    const migration = toEmbedded("0000_first.sql", "-- first");
    migration.name = migration.name.replaceAll("/", "\\");
    try {
      const folder = await resolveMigrationsFolder({
        homePath: home,
        embeddedFiles: [migration, toEmbedded("meta/_journal.json", '{"version":"7"}')],
        logger: () => {},
      });
      expect(readFileSync(join(folder.path, "0000_first.sql"), "utf8")).toBe("-- first");
      expect(readFileSync(join(folder.path, "meta/_journal.json"), "utf8")).toBe('{"version":"7"}');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

test("removes an incomplete extraction when reading an embedded file fails", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-migrations-"));
  try {
    await expect(
      resolveMigrationsFolder({
        homePath: home,
        embeddedFiles: [
          toEmbedded("0000_first.sql", "-- first"),
          {
            ...toEmbedded("0001_failed.sql", ""),
            arrayBuffer: async () => {
              throw new Error("Unreadable migration");
            },
          },
        ],
        logger: () => {},
      }),
    ).rejects.toThrow("Unreadable migration");
    expect(readdirSync(home)).toEqual([]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("does not remove or overwrite a pre-existing extraction path", async () => {
  const home = mkdtempSync(join(tmpdir(), "pstdio-migrations-"));
  const old = join(home, "pstdio-drizzle");
  mkdirSync(old);
  writeFileSync(join(old, "marker.sql"), "owned by another runtime");
  try {
    const folder = await resolveMigrationsFolder({
      homePath: home,
      embeddedFiles: [toEmbedded("0000_first.sql", "-- first")],
      logger: () => {},
    });
    expect(readFileSync(join(old, "marker.sql"), "utf8")).toBe("owned by another runtime");
    folder.cleanup();
    expect(existsSync(old)).toBe(true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("leaves the source migration folder intact after use", async () => {
  const folder = await resolveMigrationsFolder();
  expect(existsSync(join(folder.path, "meta/_journal.json"))).toBe(true);
  folder.cleanup();
  expect(existsSync(join(folder.path, "meta/_journal.json"))).toBe(true);
});
