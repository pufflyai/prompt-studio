import { describe, expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { ensureLegacyTemplateOwners, migrateLegacyTemplates, ownerExtensionIdFor } from "./legacy-template-migration";

const createLegacyDb = async () => {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`
    CREATE TABLE templates (
      id text PRIMARY KEY, project_id text, name text NOT NULL, template_type text NOT NULL,
      file_id text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, deleted_at text
    );
    CREATE TABLE installed_extension_sources (
      id text PRIMARY KEY, extension_id text NOT NULL, status text NOT NULL
    );
    CREATE TABLE extension_instances (
      id text PRIMARY KEY, installed_extension_id text NOT NULL, scope_type text NOT NULL,
      scope_id text NOT NULL, enabled boolean NOT NULL, created_at text NOT NULL
    );
    CREATE TABLE extension_files (
      id text PRIMARY KEY, project_id text NOT NULL, extension_instance_id text NOT NULL,
      file_id text NOT NULL, scope_type text NOT NULL, scope_id text, created_at text NOT NULL,
      UNIQUE (extension_instance_id, file_id)
    );
    CREATE TABLE extension_collection_items (
      project_id text, extension_instance_id text NOT NULL, scope_type text NOT NULL,
      scope_id text NOT NULL, collection text NOT NULL, item_id text NOT NULL, sort_order integer,
      value_json jsonb NOT NULL, created_at text NOT NULL, updated_at text NOT NULL,
      PRIMARY KEY (extension_instance_id, scope_type, scope_id, collection, item_id)
    );
    CREATE TABLE extension_kv (
      project_id text, extension_instance_id text NOT NULL, scope_type text NOT NULL,
      scope_id text NOT NULL, key text NOT NULL, value_json jsonb NOT NULL,
      created_at text NOT NULL, updated_at text NOT NULL,
      PRIMARY KEY (extension_instance_id, scope_type, scope_id, key)
    );
    CREATE TABLE extension_template_preferences (
      project_id text NOT NULL, extension_instance_id text NOT NULL, template_key text NOT NULL,
      enabled boolean NOT NULL, display_name_override text, metadata_json jsonb NOT NULL,
      created_at text NOT NULL, updated_at text NOT NULL
    );
    CREATE TABLE project_template_defaults (
      project_id text NOT NULL, template_type text NOT NULL, source text NOT NULL,
      template_id text, extension_instance_id text, template_key text, updated_at text NOT NULL
    );
  `);
  return db;
};

describe("legacy template ownership", () => {
  test("maps built-in template types to their owning extensions", () => {
    expect(ownerExtensionIdFor("prompt")).toBe("pstdio.pstdio-planner");
    expect(ownerExtensionIdFor("ticket")).toBe("pstdio.pstdio-planner");
    expect(ownerExtensionIdFor("document")).toBe("pstdio.pstdio-planner");
    expect(ownerExtensionIdFor("report")).toBe("pstdio.pstdio-reports");
  });

  test("refuses unknown template types", () => {
    expect(ownerExtensionIdFor("unknown")).toBeNull();
  });

  test("moves a live row into the owner collection without copying its file", async () => {
    const db = await createLegacyDb();
    try {
      await db.exec(`
        INSERT INTO installed_extension_sources VALUES ('source-1', 'pstdio.pstdio-planner', 'loaded');
        INSERT INTO extension_instances VALUES ('instance-1', 'source-1', 'project', 'project-1', true, '2026-01-01');
        INSERT INTO templates VALUES (
          'template-1', 'project-1', 'implement_ticket', 'prompt', 'file-1',
          '2026-01-01', '2026-01-02', NULL
        );
      `);

      await migrateLegacyTemplates(db);

      const items = await db.query<{ item_id: string; value_json: { blobId: string } }>(
        "SELECT item_id, value_json FROM extension_collection_items",
      );
      expect(items.rows).toEqual([
        { item_id: "implement-ticket", value_json: expect.objectContaining({ blobId: "file-1" }) },
      ]);
      const files = await db.query<{ file_id: string; scope_type: string; scope_id: string }>(
        "SELECT file_id, scope_type, scope_id FROM extension_files",
      );
      expect(files.rows).toEqual([
        { file_id: "file-1", scope_type: "collection:templates", scope_id: "implement-ticket" },
      ]);
    } finally {
      await db.close();
    }
  });

  test("keeps legacy preferences and defaults in extension-owned storage", async () => {
    const db = await createLegacyDb();
    try {
      await db.exec(`
        INSERT INTO installed_extension_sources VALUES ('source-1', 'pstdio.pstdio-planner', 'loaded');
        INSERT INTO extension_instances VALUES ('instance-1', 'source-1', 'project', 'project-1', true, '2026-01-01');
        INSERT INTO templates VALUES (
          'template-1', 'project-1', 'implement_ticket', 'prompt', 'file-1',
          '2026-01-01', '2026-01-02', NULL
        );
        INSERT INTO extension_template_preferences VALUES (
          'project-1', 'instance-1', 'implement_ticket', false, 'Implement this', '{"source":"user"}',
          '2026-01-03', '2026-01-04'
        );
        INSERT INTO project_template_defaults VALUES (
          'project-1', 'prompt', 'project_template', 'template-1', NULL, NULL, '2026-01-05'
        );
      `);

      await migrateLegacyTemplates(db);

      const values = await db.query<{ key: string; value_json: unknown }>(
        "SELECT key, value_json FROM extension_kv ORDER BY key",
      );
      expect(values.rows).toEqual([{ key: "template-defaults", value_json: { prompt: "implement-ticket" } }]);
      const preferences = await db.query<{ collection: string; item_id: string; value_json: unknown }>(
        "SELECT collection, item_id, value_json FROM extension_collection_items WHERE collection = 'template-preferences'",
      );
      expect(preferences.rows).toEqual([
        {
          collection: "template-preferences",
          item_id: "implement-ticket",
          value_json: { displayName: "Implement this", enabled: false, metadata: { source: "user" } },
        },
      ]);
    } finally {
      await db.close();
    }
  });

  test("refuses normalized template name collisions before writing either row", async () => {
    const db = await createLegacyDb();
    try {
      await db.exec(`
        INSERT INTO installed_extension_sources VALUES ('source-1', 'pstdio.pstdio-planner', 'loaded');
        INSERT INTO extension_instances VALUES ('instance-1', 'source-1', 'project', 'project-1', true, '2026-01-01');
        INSERT INTO templates VALUES
          ('template-1', 'project-1', 'foo_bar', 'prompt', 'file-1', '2026-01-01', '2026-01-02', NULL),
          ('template-2', 'project-1', 'foo-bar', 'prompt', 'file-2', '2026-01-02', '2026-01-03', NULL);
      `);

      await expect(migrateLegacyTemplates(db)).rejects.toThrow("colliding normalized names: foo_bar, foo-bar");
      const items = await db.query("SELECT * FROM extension_collection_items");
      expect(items.rows).toEqual([]);
    } finally {
      await db.close();
    }
  });

  test("refuses normalized template preference key collisions", async () => {
    const db = await createLegacyDb();
    try {
      await db.exec(`
        INSERT INTO installed_extension_sources VALUES ('source-1', 'pstdio.pstdio-planner', 'loaded');
        INSERT INTO extension_instances VALUES ('instance-1', 'source-1', 'project', 'project-1', true, '2026-01-01');
        INSERT INTO extension_template_preferences VALUES
          ('project-1', 'instance-1', 'foo_bar', true, NULL, '{}', '2026-01-01', '2026-01-01'),
          ('project-1', 'instance-1', 'foo-bar', true, NULL, '{}', '2026-01-02', '2026-01-02');
      `);

      await expect(migrateLegacyTemplates(db)).rejects.toThrow(
        "template preferences with colliding normalized keys: foo_bar, foo-bar",
      );
      const items = await db.query(
        "SELECT * FROM extension_collection_items WHERE collection = 'template-preferences'",
      );
      expect(items.rows).toEqual([]);
    } finally {
      await db.close();
    }
  });

  test("uses the one enabled owner when an older instance is disabled", async () => {
    const db = await createLegacyDb();
    try {
      await db.exec(`
        INSERT INTO installed_extension_sources VALUES
          ('source-old', 'pstdio.pstdio-planner', 'loaded'),
          ('source-current', 'pstdio.pstdio-planner', 'error');
        INSERT INTO extension_instances VALUES
          ('instance-old', 'source-old', 'project', 'project-1', false, '2025-01-01'),
          ('instance-current', 'source-current', 'project', 'project-1', true, '2026-01-01');
        INSERT INTO templates VALUES (
          'template-1', 'project-1', 'implement_ticket', 'prompt', 'file-1',
          '2026-01-01', '2026-01-02', NULL
        );
      `);

      await migrateLegacyTemplates(db);

      const items = await db.query<{ extension_instance_id: string }>(
        "SELECT extension_instance_id FROM extension_collection_items WHERE collection = 'templates'",
      );
      expect(items.rows).toEqual([{ extension_instance_id: "instance-current" }]);
    } finally {
      await db.close();
    }
  });

  test("refuses ambiguous enabled loaded owners", async () => {
    const db = await createLegacyDb();
    try {
      await db.exec(`
        INSERT INTO installed_extension_sources VALUES
          ('source-1', 'pstdio.pstdio-planner', 'loaded'),
          ('source-2', 'pstdio.pstdio-planner', 'loaded');
        INSERT INTO extension_instances VALUES
          ('instance-1', 'source-1', 'project', 'project-1', true, '2026-01-01'),
          ('instance-2', 'source-2', 'project', 'project-1', true, '2026-01-02');
        INSERT INTO templates VALUES (
          'template-1', 'project-1', 'implement_ticket', 'prompt', 'file-1',
          '2026-01-01', '2026-01-02', NULL
        );
      `);

      await expect(migrateLegacyTemplates(db)).rejects.toThrow("multiple enabled instances of pstdio.pstdio-planner");
    } finally {
      await db.close();
    }
  });

  test("re-enables the sole loaded owner instead of creating a duplicate instance", async () => {
    const db = await createLegacyDb();
    try {
      await db.exec(`
        INSERT INTO installed_extension_sources VALUES ('source-1', 'pstdio.pstdio-planner', 'loaded');
        INSERT INTO extension_instances VALUES (
          'instance-1', 'source-1', 'project', 'project-1', false, '2026-01-01'
        );
        INSERT INTO templates VALUES (
          'template-1', 'project-1', 'implement_ticket', 'prompt', 'file-1',
          '2026-01-01', '2026-01-02', NULL
        );
      `);

      await ensureLegacyTemplateOwners(db);
      await migrateLegacyTemplates(db);

      const instances = await db.query<{ enabled: boolean; id: string }>(
        "SELECT id, enabled FROM extension_instances ORDER BY id",
      );
      expect(instances.rows).toEqual([{ enabled: true, id: "instance-1" }]);
      const items = await db.query<{ extension_instance_id: string }>(
        "SELECT extension_instance_id FROM extension_collection_items WHERE collection = 'templates'",
      );
      expect(items.rows).toEqual([{ extension_instance_id: "instance-1" }]);
    } finally {
      await db.close();
    }
  });
});
