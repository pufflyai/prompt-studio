import type { PGlite } from "@electric-sql/pglite";

interface LegacyTemplate {
  id: string;
  project_id: string | null;
  name: string;
  template_type: string;
  file_id: string;
  created_at: string;
  updated_at: string;
}

interface ExtensionInstanceRow {
  id: string;
}

interface LegacyTemplatePreference {
  project_id: string;
  extension_instance_id: string;
  template_key: string;
  enabled: boolean;
  display_name_override: string | null;
  metadata_json: unknown;
  created_at: string;
  updated_at: string;
}

interface LegacyTemplateDefault {
  project_id: string;
  template_type: string;
  source: "extension_template" | "project_template";
  template_id: string | null;
  extension_instance_id: string | null;
  template_key: string | null;
  updated_at: string;
  template_name: string | null;
  project_template_type: string | null;
}

export const ownerExtensionIdFor = (templateType: string) => {
  if (["document", "prompt", "ticket"].includes(templateType)) return "pstdio.pstdio-planner";
  if (templateType === "report") return "pstdio.pstdio-reports";
  return null;
};

const legacyTablesExist = async (db: PGlite) => {
  const result = await db.query<{ name: string | null }>("SELECT to_regclass('public.templates')::text AS name");
  return result.rows[0]?.name !== null;
};

const resolveInstance = async (db: PGlite, projectId: string, extensionId: string) => {
  const result = await db.query<ExtensionInstanceRow>(
    `SELECT ei.id
       FROM extension_instances ei
       JOIN installed_extension_sources source ON source.id = ei.installed_extension_id
      WHERE ei.scope_type = 'project' AND ei.scope_id = $1 AND source.extension_id = $2
      ORDER BY ei.created_at
      LIMIT 1`,
    [projectId, extensionId],
  );
  return result.rows[0]?.id ?? null;
};

const migrateTemplate = async (db: PGlite, template: LegacyTemplate) => {
  const ownerExtensionId = ownerExtensionIdFor(template.template_type);
  if (!template.project_id || !ownerExtensionId) return false;
  const instanceId = await resolveInstance(db, template.project_id, ownerExtensionId);
  if (!instanceId) return false;
  const name = template.name.replaceAll("_", "-");

  await db.query(
    `INSERT INTO extension_files
       (id, project_id, extension_instance_id, file_id, scope_type, scope_id, created_at)
     VALUES ($1, $2, $3, $4, 'collection:templates', $5, $6)
     ON CONFLICT (extension_instance_id, file_id)
     DO UPDATE SET scope_type = 'collection:templates', scope_id = EXCLUDED.scope_id`,
    [crypto.randomUUID(), template.project_id, instanceId, template.file_id, name, template.created_at],
  );
  await db.query(
    `INSERT INTO extension_collection_items
       (project_id, extension_instance_id, scope_type, scope_id, collection, item_id, sort_order,
        value_json, created_at, updated_at)
     VALUES ($1, $2, 'project', $1, 'templates', $3, NULL, $4::jsonb, $5, $6)
     ON CONFLICT (extension_instance_id, scope_type, scope_id, collection, item_id)
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = EXCLUDED.updated_at`,
    [
      template.project_id,
      instanceId,
      name,
      JSON.stringify({ name, title: name, type: template.template_type, blobId: template.file_id }),
      template.created_at,
      template.updated_at,
    ],
  );
  return true;
};

const putExtensionValue = async (
  db: PGlite,
  input: { projectId: string; instanceId: string; key: string; value: unknown; createdAt: string; updatedAt: string },
) => {
  await db.query(
    `INSERT INTO extension_kv
       (project_id, extension_instance_id, scope_type, scope_id, key, value_json, created_at, updated_at)
     VALUES ($1, $2, 'project', $1, $3, $4::jsonb, $5, $6)
     ON CONFLICT (extension_instance_id, scope_type, scope_id, key)
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = EXCLUDED.updated_at`,
    [input.projectId, input.instanceId, input.key, JSON.stringify(input.value), input.createdAt, input.updatedAt],
  );
};

const migratePreferences = async (db: PGlite) => {
  const result = await db.query<LegacyTemplatePreference>(
    `SELECT project_id, extension_instance_id, template_key, enabled, display_name_override,
            metadata_json, created_at, updated_at
       FROM extension_template_preferences
      ORDER BY created_at, template_key`,
  );
  for (const preference of result.rows) {
    const name = preference.template_key.replaceAll("_", "-");
    await putExtensionValue(db, {
      projectId: preference.project_id,
      instanceId: preference.extension_instance_id,
      key: `templates.preference.${name}`,
      value: {
        enabled: preference.enabled,
        displayName: preference.display_name_override,
        metadata: preference.metadata_json,
      },
      createdAt: preference.created_at,
      updatedAt: preference.updated_at,
    });
  }
};

const migrateDefaults = async (db: PGlite) => {
  const result = await db.query<LegacyTemplateDefault>(
    `SELECT defaults.project_id, defaults.template_type, defaults.source, defaults.template_id,
            defaults.extension_instance_id, defaults.template_key, defaults.updated_at,
            templates.name AS template_name, templates.template_type AS project_template_type
       FROM project_template_defaults defaults
       LEFT JOIN templates ON templates.id = defaults.template_id
      ORDER BY defaults.project_id, defaults.template_type`,
  );
  const orphans: LegacyTemplateDefault[] = [];
  for (const entry of result.rows) {
    const extensionTemplate = entry.source === "extension_template";
    const name = (extensionTemplate ? entry.template_key : entry.template_name)?.replaceAll("_", "-");
    const instanceId = extensionTemplate
      ? entry.extension_instance_id
      : await resolveInstance(db, entry.project_id, ownerExtensionIdFor(entry.project_template_type ?? "") ?? "");
    if (!name || !instanceId) {
      orphans.push(entry);
      continue;
    }
    await putExtensionValue(db, {
      projectId: entry.project_id,
      instanceId,
      key: `templates.default.${entry.template_type}`,
      value: { name },
      createdAt: entry.updated_at,
      updatedAt: entry.updated_at,
    });
  }
  if (orphans.length > 0) {
    const details = orphans.map((row) => `${row.project_id}/${row.template_type}`).join(", ");
    throw new Error(`Cannot migrate legacy template defaults without an installed owning extension: ${details}`);
  }
};

export const migrateLegacyTemplates = async (db: PGlite) => {
  if (!(await legacyTablesExist(db))) return;
  const result = await db.query<LegacyTemplate>(
    `SELECT id, project_id, name, template_type, file_id, created_at, updated_at
       FROM templates
      WHERE deleted_at IS NULL
      ORDER BY created_at, id`,
  );
  const orphans: LegacyTemplate[] = [];
  for (const template of result.rows) {
    if (!(await migrateTemplate(db, template))) orphans.push(template);
  }
  if (orphans.length > 0) {
    const details = orphans.map((row) => `${row.id} (${row.template_type}/${row.name})`).join(", ");
    throw new Error(`Cannot migrate legacy templates without an installed owning extension: ${details}`);
  }
  await migratePreferences(db);
  await migrateDefaults(db);
};
