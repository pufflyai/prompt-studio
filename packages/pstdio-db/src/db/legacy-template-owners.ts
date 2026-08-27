import type { PGlite } from "@electric-sql/pglite";

interface ExtensionInstanceRow {
  enabled?: boolean;
  id: string;
}

interface InstalledExtensionSourceRow {
  id: string;
}

export const legacyTemplateOwnerSourcePath = (extensionId: string) => `pstdio:legacy-template-owner:${extensionId}`;

export const ownerExtensionIdFor = (templateType: string) => {
  if (["document", "prompt", "ticket"].includes(templateType)) return "pstdio.pstdio-planner";
  if (templateType === "report") return "pstdio.pstdio-reports";
  return null;
};

export const hasLegacyTemplatesTable = async (db: PGlite) => {
  const result = await db.query<{ templates: string | null }>(
    "SELECT to_regclass('public.templates')::text AS templates",
  );
  return Boolean(result.rows[0]?.templates);
};

export const resolveLegacyTemplateInstance = async (db: PGlite, projectId: string, extensionId: string) => {
  const result = await db.query<ExtensionInstanceRow>(
    `SELECT ei.id
       FROM extension_instances ei
       JOIN installed_extension_sources source ON source.id = ei.installed_extension_id
      WHERE ei.scope_type = 'project' AND ei.scope_id = $1 AND source.extension_id = $2
        AND ei.enabled = true
      ORDER BY ei.created_at, ei.id`,
    [projectId, extensionId],
  );
  if (result.rows.length > 1) {
    throw new Error(`Cannot migrate templates with multiple enabled instances of ${extensionId}`);
  }
  return result.rows[0]?.id ?? null;
};

const ownerInstallName = (extensionId: string) => {
  if (extensionId === "pstdio.pstdio-planner") return "pstdio-planner";
  if (extensionId === "pstdio.pstdio-reports") return "pstdio-reports";
  throw new Error(`Unknown legacy template owner: ${extensionId}`);
};

const ensureOwnerSource = async (db: PGlite, extensionId: string, timestamp: string) => {
  const existing = await db.query<InstalledExtensionSourceRow>(
    `SELECT id
       FROM installed_extension_sources
      WHERE extension_id = $1
      ORDER BY created_at, id`,
    [extensionId],
  );
  if (existing.rows.length > 1) {
    throw new Error(`Cannot migrate templates with multiple installed sources of ${extensionId}`);
  }
  if (existing.rows[0]) return existing.rows[0].id;

  const id = crypto.randomUUID();
  const installName = ownerInstallName(extensionId);
  await db.query(
    `INSERT INTO installed_extension_sources
       (id, install_name, extension_id, display_name, version, source_kind, source_path, source_ref,
        manifest_json, source_hash, loaded_revision, status, last_loaded_at, last_error_json,
        created_at, updated_at)
     VALUES ($1, $2, $3, $2, NULL, 'local_path', $4, NULL, $5::jsonb, NULL, NULL, 'loaded',
             NULL, NULL, $6, $6)`,
    [
      id,
      installName,
      extensionId,
      legacyTemplateOwnerSourcePath(extensionId),
      JSON.stringify({ id: extensionId }),
      timestamp,
    ],
  );
  return id;
};

export const ensureLegacyTemplateOwners = async (db: PGlite) => {
  if (!(await hasLegacyTemplatesTable(db))) return;
  const templates = await db.query<{ project_id: string | null; template_type: string; created_at: string }>(
    `SELECT project_id, template_type, created_at
       FROM templates
      WHERE deleted_at IS NULL AND project_id IS NOT NULL
      ORDER BY created_at`,
  );
  const owners = new Map<string, { projectId: string; extensionId: string; timestamp: string }>();
  for (const template of templates.rows) {
    const extensionId = ownerExtensionIdFor(template.template_type);
    if (!template.project_id || !extensionId) continue;
    const key = `${template.project_id}\0${extensionId}`;
    if (!owners.has(key)) {
      owners.set(key, { projectId: template.project_id, extensionId, timestamp: template.created_at });
    }
  }

  for (const owner of owners.values()) {
    if (await resolveLegacyTemplateInstance(db, owner.projectId, owner.extensionId)) continue;
    const existingInstances = await db.query<ExtensionInstanceRow>(
      `SELECT ei.id, ei.enabled
         FROM extension_instances ei
         JOIN installed_extension_sources source ON source.id = ei.installed_extension_id
        WHERE ei.scope_type = 'project' AND ei.scope_id = $1 AND source.extension_id = $2
        ORDER BY ei.created_at, ei.id`,
      [owner.projectId, owner.extensionId],
    );
    if (existingInstances.rows.length > 1) {
      throw new Error(`Cannot migrate templates with multiple disabled instances of ${owner.extensionId}`);
    }
    const existingInstance = existingInstances.rows[0];
    if (existingInstance) {
      await db.query("UPDATE extension_instances SET enabled = true WHERE id = $1", [existingInstance.id]);
      continue;
    }
    const sourceId = await ensureOwnerSource(db, owner.extensionId, owner.timestamp);
    await db.query(
      `INSERT INTO extension_instances
         (id, installed_extension_id, scope_type, scope_id, enabled, config_json, diagnostics_json,
          created_at, updated_at)
       VALUES ($1, $2, 'project', $3, true, '{}'::jsonb, NULL, $4, $4)`,
      [crypto.randomUUID(), sourceId, owner.projectId, owner.timestamp],
    );
  }
};
