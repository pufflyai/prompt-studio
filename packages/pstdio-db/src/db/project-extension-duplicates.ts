import { sql } from "drizzle-orm";
import { canonicalExtensionId, extensionIdentityRenames } from "pstdio-api-contracts/extension-host";
import { projectExtensionId } from "../services/extension-instances/project-extension-row";
import { mergeInstancePreferences } from "../services/extension-preferences/instance-preferences";
import type { DbClient } from "./connection.pglite";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Duplicate = { project_id: string; extension_ref: string; retained_ref: string };

const installedIdentity = sql`CASE s.extension_id ${sql.join(
  extensionIdentityRenames.map(({ from }) => {
    const historical = `${from.publisher}.${from.name}`;
    return sql`WHEN ${historical} THEN ${canonicalExtensionId(historical)}`;
  }),
  sql` `,
)} ELSE s.extension_id END`;

/** Keep the selected source and archive the other records before retiring their project attachments. */
export const collapseDuplicateProjectExtensions = async (db: DbClient, path: string) => {
  const { rows } = await db.execute<Duplicate>(sql`
    SELECT project_id, extension_ref, retained_ref FROM (
      SELECT e.project_id, e.extension_ref, first_value(e.extension_ref) OVER providers AS retained_ref,
        row_number() OVER providers AS preference
      FROM project_extensions e JOIN extensions s ON s.id=e.extension_ref
      WINDOW providers AS (PARTITION BY e.project_id, ${installedIdentity}
        ORDER BY e.enabled DESC, (s.status = 'loaded') DESC, e.updated_at DESC, e.created_at DESC, e.extension_ref)
    ) ranked WHERE preference > 1 ORDER BY project_id, retained_ref, preference
  `);
  if (!rows.length) return false;

  const ids = JSON.stringify(
    rows.map((row) => ({
      ...row,
      instance_id: projectExtensionId(row.project_id, row.extension_ref),
    })),
  );
  const archive = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "project_extensions",
      keys: ["project_id", "extension_ref"],
      name: "duplicate-project-extensions",
      archive: () => `duplicate-project-extensions-${Date.now()}`,
      select: sql`SELECT i.project_id, i.extension_ref, to_jsonb(e) AS installation, to_jsonb(s) AS source,
        (SELECT jsonb_agg(to_jsonb(p)) FROM preferences p WHERE p.scope='project'
          AND p.project_id=i.project_id AND p.scope_id=i.instance_id) AS preferences
        FROM jsonb_to_recordset(${ids}::jsonb) AS i(project_id text, extension_ref text, instance_id text)
        JOIN project_extensions e USING(project_id,extension_ref) JOIN extensions s ON s.id=i.extension_ref`,
    },
    async () => {},
  );
  await archive?.complete();

  await db.transaction(async (tx) => {
    for (const { project_id: projectId, extension_ref: source, retained_ref: retained } of rows) {
      await mergeInstancePreferences(
        tx,
        projectId,
        projectExtensionId(projectId, source),
        projectExtensionId(projectId, retained),
      );
      await tx.execute(sql`UPDATE project_extensions AS current
        SET config_json=previous.config_json || current.config_json,
          display_name=coalesce(current.display_name,previous.display_name)
        FROM project_extensions AS previous
        WHERE current.project_id=${projectId} AND previous.project_id=current.project_id
          AND current.extension_ref=${retained} AND previous.extension_ref=${source}`);
      await tx.execute(sql`DELETE FROM project_extensions WHERE project_id=${projectId} AND extension_ref=${source}`);
    }
    // Keep local checkouts and their discovery metadata. A retired publication is no longer installed.
    await tx.execute(sql`DELETE FROM extensions s WHERE starts_with(s.source_ref, 'pstdio-published:')
      AND s.id IN (SELECT extension_ref FROM jsonb_to_recordset(${ids}::jsonb) AS i(extension_ref text))
      AND NOT EXISTS (SELECT 1 FROM project_extensions e WHERE e.extension_ref=s.id)`);
  });
  return true;
};
