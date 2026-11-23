import { isDeepStrictEqual } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { timestampToIso } from "./schemas/iso-timestamp";
import { project_extensions } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Legacy = {
  id: string;
  installed_extension_id: string;
  scope_type: string;
  scope_id: string;
  display_name_override: string | null;
  enabled: boolean;
  config_json: (typeof project_extensions.$inferSelect)["config_json"];
  diagnostics_json: (typeof project_extensions.$inferSelect)["diagnostics_json"];
  created_at: string;
  updated_at: string;
};
export const prepareProjectExtensionsUpgrade = (db: DbClient, path: string) =>
  prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "extension_instances",
      keys: ["id"],
      name: "project-extensions",
      archive: "extension-instances",
      select: sql`SELECT i.id,to_jsonb(i) AS released,p.id AS project
        FROM extension_instances i LEFT JOIN projects p
          ON i.scope_type='project' AND p.id=i.scope_id`,
    },
    async (input) => {
      const { released, project } = input as unknown as { released: Legacy; project: string | null };
      // Non-project and orphan scopes have no target in the project-only schema.
      // The exact exported row remains available, including all configuration.
      if (!project) return;
      const expected = {
        project_id: project,
        extension_ref: released.installed_extension_id,
        display_name: released.display_name_override,
        enabled: released.enabled,
        config_json: released.config_json,
        diagnostics_json: released.diagnostics_json,
        created_at: timestampToIso(released.created_at),
        updated_at: timestampToIso(released.updated_at),
      };
      const [existing] = await db
        .select()
        .from(project_extensions)
        .where(
          and(
            eq(project_extensions.project_id, project),
            eq(project_extensions.extension_ref, released.installed_extension_id),
          ),
        );
      if (existing && !isDeepStrictEqual(existing, expected))
        throw new Error("Project extension restoration conflicts with existing configuration.");
      if (!existing) await db.insert(project_extensions).values(expected);
    },
    async (row) => ({ released: row.released, project: row.project }),
  );
