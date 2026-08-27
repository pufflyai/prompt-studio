import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_skill_preferences } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

type SkillPrefRow = typeof extension_skill_preferences.$inferSelect;

export type SetSkillPreferenceInput = {
  project_id: string;
  extension_instance_id: string;
  skill_key: string;
  enabled?: boolean;
  display_name_override?: string | null;
  description_override?: string | null;
  metadata_json?: SkillPrefRow["metadata_json"];
};

export const createExtensionSkillPreferencesDBService = (db: DbClient) => {
  const list = async (projectId: string, extensionInstanceId?: string) => {
    const conditions = [eq(extension_skill_preferences.project_id, projectId)];
    if (extensionInstanceId) {
      conditions.push(eq(extension_skill_preferences.extension_instance_id, extensionInstanceId));
    }
    return db
      .select()
      .from(extension_skill_preferences)
      .where(and(...conditions))
      .orderBy(extension_skill_preferences.skill_key);
  };

  const get = async (projectId: string, extensionInstanceId: string, skillKey: string) => {
    const [row] = await db
      .select()
      .from(extension_skill_preferences)
      .where(
        and(
          eq(extension_skill_preferences.project_id, projectId),
          eq(extension_skill_preferences.extension_instance_id, extensionInstanceId),
          eq(extension_skill_preferences.skill_key, skillKey),
        ),
      );
    return row ?? null;
  };

  const set = async (input: SetSkillPreferenceInput) => {
    const timestamp = nowTimestamp();
    const existing = await get(input.project_id, input.extension_instance_id, input.skill_key);

    if (existing) {
      await db
        .update(extension_skill_preferences)
        .set({
          enabled: input.enabled ?? existing.enabled,
          display_name_override:
            input.display_name_override !== undefined ? input.display_name_override : existing.display_name_override,
          description_override:
            input.description_override !== undefined ? input.description_override : existing.description_override,
          metadata_json: input.metadata_json ?? existing.metadata_json,
          updated_at: timestamp,
        })
        .where(
          and(
            eq(extension_skill_preferences.project_id, input.project_id),
            eq(extension_skill_preferences.extension_instance_id, input.extension_instance_id),
            eq(extension_skill_preferences.skill_key, input.skill_key),
          ),
        );
      return { ...existing, ...input, updated_at: timestamp };
    }

    const row = {
      project_id: input.project_id,
      extension_instance_id: input.extension_instance_id,
      skill_key: input.skill_key,
      enabled: input.enabled ?? true,
      display_name_override: input.display_name_override ?? null,
      description_override: input.description_override ?? null,
      metadata_json: input.metadata_json ?? {},
      created_at: timestamp,
      updated_at: timestamp,
    };
    await db.insert(extension_skill_preferences).values(row);
    return row;
  };

  const remove = async (projectId: string, extensionInstanceId: string, skillKey: string) => {
    const deleted = await db
      .delete(extension_skill_preferences)
      .where(
        and(
          eq(extension_skill_preferences.project_id, projectId),
          eq(extension_skill_preferences.extension_instance_id, extensionInstanceId),
          eq(extension_skill_preferences.skill_key, skillKey),
        ),
      )
      .returning({ skill_key: extension_skill_preferences.skill_key });
    return deleted.length > 0;
  };

  return { list, get, set, remove };
};
