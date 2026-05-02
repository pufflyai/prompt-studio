import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_template_preferences } from "../../db/schemas.pg";

type SetInput = {
  project_id: string;
  extension_id: string;
  template_key: string;
  enabled: boolean;
};

const nowTimestamp = () => new Date().toISOString();

export const createExtensionTemplatePreferencesDBService = (db: DbClient) => {
  const isEnabled = async (projectId: string, extensionId: string, templateKey: string) => {
    const [row] = await db
      .select()
      .from(extension_template_preferences)
      .where(
        and(
          eq(extension_template_preferences.project_id, projectId),
          eq(extension_template_preferences.extension_id, extensionId),
          eq(extension_template_preferences.template_key, templateKey),
        ),
      );
    return row ? row.enabled : true;
  };

  const setEnabled = async (input: SetInput) => {
    const timestamp = nowTimestamp();

    await db
      .insert(extension_template_preferences)
      .values({
        project_id: input.project_id,
        extension_id: input.extension_id,
        template_key: input.template_key,
        enabled: input.enabled,
        updated_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [
          extension_template_preferences.project_id,
          extension_template_preferences.extension_id,
          extension_template_preferences.template_key,
        ],
        set: {
          enabled: input.enabled,
          updated_at: timestamp,
        },
      });
  };

  const listByExtension = async (projectId: string, extensionId: string) =>
    db
      .select()
      .from(extension_template_preferences)
      .where(
        and(
          eq(extension_template_preferences.project_id, projectId),
          eq(extension_template_preferences.extension_id, extensionId),
        ),
      )
      .orderBy(extension_template_preferences.template_key);

  return { isEnabled, setEnabled, listByExtension };
};
