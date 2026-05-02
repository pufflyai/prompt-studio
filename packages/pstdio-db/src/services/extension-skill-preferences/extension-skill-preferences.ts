import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_skill_preferences } from "../../db/schemas.pg";

type SetInput = {
  project_id: string;
  extension_id: string;
  skill_key: string;
  enabled: boolean;
};

const nowTimestamp = () => new Date().toISOString();

export const createExtensionSkillPreferencesDBService = (db: DbClient) => {
  const isEnabled = async (projectId: string, extensionId: string, skillKey: string) => {
    const [row] = await db
      .select()
      .from(extension_skill_preferences)
      .where(
        and(
          eq(extension_skill_preferences.project_id, projectId),
          eq(extension_skill_preferences.extension_id, extensionId),
          eq(extension_skill_preferences.skill_key, skillKey),
        ),
      );
    return row ? row.enabled : true;
  };

  const setEnabled = async (input: SetInput) => {
    const timestamp = nowTimestamp();

    await db
      .insert(extension_skill_preferences)
      .values({
        project_id: input.project_id,
        extension_id: input.extension_id,
        skill_key: input.skill_key,
        enabled: input.enabled,
        updated_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [
          extension_skill_preferences.project_id,
          extension_skill_preferences.extension_id,
          extension_skill_preferences.skill_key,
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
      .from(extension_skill_preferences)
      .where(
        and(
          eq(extension_skill_preferences.project_id, projectId),
          eq(extension_skill_preferences.extension_id, extensionId),
        ),
      )
      .orderBy(extension_skill_preferences.skill_key);

  return { isEnabled, setEnabled, listByExtension };
};
