import { expect, test } from "bun:test";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { migrateThrough } from "./migrate-through";
import * as schema from "./schemas.pg";

const migrationsFolder = join(import.meta.dir, "../../drizzle");

test("saved board views keep their filters and ordering as rules and sorts", async () => {
  const pglite = new PGlite();
  await pglite.waitReady;
  try {
    const db = drizzle(pglite, { schema });
    await migrateThrough(db, migrationsFolder, 34);
    await pglite.exec(`
      INSERT INTO projects (id, name, shorthand, created_at, updated_at) VALUES ('p', 'P', 'P', '1', '1');
      INSERT INTO installed_extension_sources (id, install_name, extension_id, display_name, source_kind, source_path, created_at, updated_at)
        VALUES ('src', 'boards', 'test.boards', 'Boards', 'local_path', '/boards', '1', '1');
      INSERT INTO extension_instances (id, installed_extension_id, scope_type, scope_id, created_at, updated_at)
        VALUES ('inst', 'src', 'project', 'p', '1', '1');
    `);
    const insert = (id: string, settings: object, filters: object) =>
      pglite.query(
        `INSERT INTO board_views (id, project_id, extension_instance_id, board_id, title, settings, filters, sort_order, created_at, updated_at)
         VALUES ($1, 'p', 'inst', 'tasks', $1, $2, $3, 0, '1', '1')`,
        [id, settings, filters],
      );
    const display = { viewMode: "list", columnGrouping: "status", rowGrouping: "none", displayProperties: ["id"] };
    await insert(
      "sorted",
      { ...display, ordering: { attributeId: "updated", direction: "desc" } },
      { status: ["todo"], priority: ["urgent", "high"], tags: [] },
    );
    await insert("manual", { ...display, ordering: { attributeId: "manual", direction: "asc" } }, {});

    await migrate(db, { migrationsFolder });

    const { rows } = await pglite.query("SELECT id, settings, filter, sorts FROM board_views ORDER BY id");
    expect(rows).toEqual([
      { id: "manual", settings: display, filter: { conjunction: "and", rules: [] }, sorts: [] },
      {
        id: "sorted",
        settings: display,
        filter: {
          conjunction: "and",
          rules: [
            { attributeId: "priority", condition: "is-any-of", value: ["urgent", "high"] },
            { attributeId: "status", condition: "is-any-of", value: ["todo"] },
          ],
        },
        sorts: [{ attributeId: "updated", direction: "desc" }],
      },
    ]);
  } finally {
    await pglite.close();
  }
});
