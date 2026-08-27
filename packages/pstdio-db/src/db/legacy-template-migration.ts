import type { PGlite } from "@electric-sql/pglite";
import { ownerExtensionIdFor, resolveLegacyTemplateInstance } from "./legacy-template-owners";

export {
  ensureLegacyTemplateOwners,
  hasLegacyTemplatesTable,
  legacyTemplateOwnerSourcePath,
  ownerExtensionIdFor,
} from "./legacy-template-owners";

interface LegacyTemplate {
  id: string;
  project_id: string | null;
  name: string;
  template_type: string;
  file_id: string;
  created_at: string;
  updated_at: string;
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

const legacyTablesExist = async (db: PGlite) => {
  const result = await db.query<Record<string, string | null>>(`
    SELECT to_regclass('public.templates')::text AS templates,
           to_regclass('public.extension_instances')::text AS extension_instances,
           to_regclass('public.installed_extension_sources')::text AS installed_extension_sources,
           to_regclass('public.extension_files')::text AS extension_files,
           to_regclass('public.extension_collection_items')::text AS extension_collection_items,
           to_regclass('public.extension_kv')::text AS extension_kv,
           to_regclass('public.extension_template_preferences')::text AS extension_template_preferences,
           to_regclass('public.project_template_defaults')::text AS project_template_defaults
  `);
  const tables = result.rows[0];
  if (!tables?.templates) return false;
  const missing = Object.entries(tables)
    .filter(([name, value]) => name !== "templates" && value === null)
    .map(([name]) => name);
  if (missing.length > 0) throw new Error(`Legacy template migration storage is missing: ${missing.join(", ")}`);
  return true;
};

const migrateTemplate = async (db: PGlite, template: LegacyTemplate) => {
  const ownerExtensionId = ownerExtensionIdFor(template.template_type);
  if (!template.project_id || !ownerExtensionId) return false;
  const instanceId = await resolveLegacyTemplateInstance(db, template.project_id, ownerExtensionId);
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
  const keys = new Map<string, string>();
  for (const preference of result.rows) {
    const name = preference.template_key.replaceAll("_", "-");
    const key = `${preference.project_id}\0${preference.extension_instance_id}\0${name}`;
    const existing = keys.get(key);
    if (existing) {
      throw new Error(
        `Cannot migrate legacy template preferences with colliding normalized keys: ${existing}, ${preference.template_key}`,
      );
    }
    keys.set(key, preference.template_key);
  }
  for (const preference of result.rows) {
    const name = preference.template_key.replaceAll("_", "-");
    await db.query(
      `INSERT INTO extension_collection_items
         (project_id, extension_instance_id, scope_type, scope_id, collection, item_id, sort_order,
          value_json, created_at, updated_at)
       VALUES ($1, $2, 'project', $1, 'template-preferences', $3, NULL, $4::jsonb, $5, $6)
       ON CONFLICT (extension_instance_id, scope_type, scope_id, collection, item_id)
       DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = EXCLUDED.updated_at`,
      [
        preference.project_id,
        preference.extension_instance_id,
        name,
        JSON.stringify({
          enabled: preference.enabled,
          displayName: preference.display_name_override,
          metadata: preference.metadata_json,
        }),
        preference.created_at,
        preference.updated_at,
      ],
    );
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
  const values = new Map<
    string,
    { projectId: string; instanceId: string; updatedAt: string; defaults: Record<string, string> }
  >();
  for (const entry of result.rows) {
    const extensionTemplate = entry.source === "extension_template";
    const name = (extensionTemplate ? entry.template_key : entry.template_name)?.replaceAll("_", "-");
    const instanceId = extensionTemplate
      ? entry.extension_instance_id
      : await resolveLegacyTemplateInstance(
          db,
          entry.project_id,
          ownerExtensionIdFor(entry.project_template_type ?? "") ?? "",
        );
    if (!name || !instanceId) {
      orphans.push(entry);
      continue;
    }
    const key = `${entry.project_id}\0${instanceId}`;
    const value = values.get(key) ?? {
      projectId: entry.project_id,
      instanceId,
      updatedAt: entry.updated_at,
      defaults: {},
    };
    value.defaults[entry.template_type] = name;
    if (entry.updated_at > value.updatedAt) value.updatedAt = entry.updated_at;
    values.set(key, value);
  }
  if (orphans.length > 0) {
    const details = orphans.map((row) => `${row.project_id}/${row.template_type}`).join(", ");
    throw new Error(`Cannot migrate legacy template defaults without an installed owning extension: ${details}`);
  }
  for (const value of values.values()) {
    await putExtensionValue(db, {
      projectId: value.projectId,
      instanceId: value.instanceId,
      key: "template-defaults",
      value: value.defaults,
      createdAt: value.updatedAt,
      updatedAt: value.updatedAt,
    });
  }
};

const assertNoNormalizedNameCollisions = (templates: LegacyTemplate[]) => {
  const names = new Map<string, LegacyTemplate>();
  for (const template of templates) {
    const owner = ownerExtensionIdFor(template.template_type);
    if (!template.project_id || !owner) continue;
    const name = template.name.replaceAll("_", "-");
    const key = `${template.project_id}\0${owner}\0${name}`;
    const existing = names.get(key);
    if (existing) {
      throw new Error(
        `Cannot migrate legacy templates with colliding normalized names: ${existing.name}, ${template.name}`,
      );
    }
    names.set(key, template);
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
  assertNoNormalizedNameCollisions(result.rows);
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
