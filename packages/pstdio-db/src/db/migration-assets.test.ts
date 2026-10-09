import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveMigrationsFolder } from "./connection.pglite";

test("prepares runtime migrations without reading schema-generation snapshots", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-runtime-migrations-"));
  const migration = "SELECT 1;";
  const journal = JSON.stringify({ entries: [{ tag: "0000_initial" }] });
  const embedded = (name: string, content: string) => ({
    name: `../../pstdio-db/drizzle/${name}`,
    size: content.length,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  });
  try {
    const folder = await resolveMigrationsFolder({
      tmpDir: root,
      embeddedFiles: [
        embedded("0000_initial.sql", migration),
        embedded("meta/_journal.json", journal),
        {
          ...embedded("meta/0000_snapshot.json", "{}"),
          arrayBuffer: async () => {
            throw new Error("Schema generation data is not a runtime dependency.");
          },
        },
      ],
      logger: () => {},
    });
    expect(readFileSync(join(folder, "0000_initial.sql"), "utf8")).toBe(migration);
    expect(JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")).entries).toEqual([
      { tag: "0000_initial" },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
