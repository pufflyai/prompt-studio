import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { project_template_defaults } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export type SetProjectTemplateDefaultInput = {
  project_id: string;
  template_type: string;
} & (
  | { source: "project_template"; template_id: string; extension_instance_id?: never; template_key?: never }
  | { source: "extension_template"; extension_instance_id: string; template_key: string; template_id?: never }
);

export const createProjectTemplateDefaultsDBService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(project_template_defaults)
      .where(eq(project_template_defaults.project_id, projectId))
      .orderBy(project_template_defaults.template_type);

  const get = async (projectId: string, templateType: string) => {
    const [row] = await db
      .select()
      .from(project_template_defaults)
      .where(
        and(
          eq(project_template_defaults.project_id, projectId),
          eq(project_template_defaults.template_type, templateType),
        ),
      );
    return row ?? null;
  };

  const set = async (input: SetProjectTemplateDefaultInput) => {
    const timestamp = nowTimestamp();
    const existing = await get(input.project_id, input.template_type);

    const values =
      input.source === "project_template"
        ? {
            project_id: input.project_id,
            template_type: input.template_type,
            source: "project_template" as const,
            template_id: input.template_id,
            extension_instance_id: null,
            template_key: null,
            updated_at: timestamp,
          }
        : {
            project_id: input.project_id,
            template_type: input.template_type,
            source: "extension_template" as const,
            template_id: null,
            extension_instance_id: input.extension_instance_id,
            template_key: input.template_key,
            updated_at: timestamp,
          };

    if (existing) {
      await db
        .update(project_template_defaults)
        .set(values)
        .where(
          and(
            eq(project_template_defaults.project_id, input.project_id),
            eq(project_template_defaults.template_type, input.template_type),
          ),
        );
    } else {
      await db.insert(project_template_defaults).values(values);
    }

    return values;
  };

  const remove = async (projectId: string, templateType: string) => {
    const deleted = await db
      .delete(project_template_defaults)
      .where(
        and(
          eq(project_template_defaults.project_id, projectId),
          eq(project_template_defaults.template_type, templateType),
        ),
      )
      .returning({ template_type: project_template_defaults.template_type });
    return deleted.length > 0;
  };

  return { list, get, set, remove };
};
