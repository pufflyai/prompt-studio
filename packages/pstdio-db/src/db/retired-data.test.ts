import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrateThrough } from "./migrate-through";
import { readRetiredData } from "./retired-data";

test("schema removal retains original project records for an extension to import later", async () => {
  const folder = mkdtempSync(join(tmpdir(), "retired-data-"));
  const client = new PGlite();
  const db = drizzle(client);
  mkdirSync(join(folder, "meta"));
  writeFileSync(
    join(folder, "meta/_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [
        { idx: 0, version: "7", when: 1000, tag: "0000_original", breakpoints: true },
        { idx: 1, version: "7", when: 2000, tag: "0001_retired", breakpoints: true },
      ],
    }),
  );
  writeFileSync(
    join(folder, "0000_original.sql"),
    `CREATE TABLE old_notes (project_id text, extension_instance_id text, body text);--> statement-breakpoint
INSERT INTO old_notes VALUES ('first', NULL, 'shared'), ('second', NULL, 'other project'), ('first', 'mine', 'owned'), ('first', 'other', 'private');`,
  );
  writeFileSync(join(folder, "0001_retired.sql"), 'DROP TABLE "old_notes" CASCADE;');
  try {
    await migrateThrough(db as never, folder, 1);
    const scope = { projectId: "first", extensionInstanceId: "mine" };
    const retained = await readRetiredData(db as never, "old_notes", scope);
    expect(retained?.version).toBe("0000_original");
    expect(retained?.records.map((row) => row.body)).toEqual(["shared", "owned"]);
    await migrateThrough(db as never, folder, 1);
    expect(await readRetiredData(db as never, "old_notes", scope)).toEqual(retained);
    expect(await readRetiredData(db as never, "active_settings", scope)).toBeUndefined();
    expect(await readRetiredData(db as never, "old_notes", { ...scope, projectId: "second" })).toMatchObject({
      records: [{ project_id: "second", extension_instance_id: null, body: "other project" }],
    });
  } finally {
    await client.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
