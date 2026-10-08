import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveMigrationsFolder } from "./connection.pglite";

describe("resolveMigrationsFolder", () => {
  const toEmbedded = (name: string, content: string) => ({
    name: `../../pstdio-db/drizzle/${name}`,
    size: content.length,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  });

  it("extracts all embedded migrations to disk", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-migrations-"));

    const journal = '{"version":"7","entries":[{"idx":0,"tag":"0000_lush_corsair"}]}';

    const extractionRoot = await resolveMigrationsFolder({
      tmpDir: tempRoot,
      embeddedFiles: [toEmbedded("0000_lush_corsair.sql", "-- migration"), toEmbedded("meta/_journal.json", journal)],
      logger: () => {},
    });

    expect(fs.existsSync(path.join(extractionRoot, "0000_lush_corsair.sql"))).toBe(true);
    expect(fs.existsSync(path.join(extractionRoot, "meta", "_journal.json"))).toBe(true);

    fs.rmSync(tempRoot, { force: true, recursive: true });
  });

  it("keeps concurrent migration extractions independent", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-migrations-concurrent-"));
    try {
      const [first, second] = await Promise.all(
        ["first", "second"].map((content) =>
          resolveMigrationsFolder({
            tmpDir: tempRoot,
            embeddedFiles: [toEmbedded("0000_start.sql", content)],
            logger: () => {},
          }),
        ),
      );
      expect(first).not.toBe(second);
      expect(fs.readFileSync(path.join(first, "0000_start.sql"), "utf8")).toBe("first");
      expect(fs.readFileSync(path.join(second, "0000_start.sql"), "utf8")).toBe("second");
    } finally {
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
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

      expect(fs.existsSync(path.join(folder, "0000_lush_corsair.sql"))).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
