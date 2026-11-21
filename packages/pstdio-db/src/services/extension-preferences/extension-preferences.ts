import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas/preferences";
import { instancePreferenceOwner } from "../preferences/preference-owners";
import { instancePreferenceIdentity, instancePreferenceWhere } from "./instance-preferences";

interface SkillValue {
  enabled: boolean;
  display_name_override: string | null;
  description_override: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}
export type SetSkillPreferenceInput = {
  project_id: string;
  extension_instance_id: string;
  skill_key: string;
  enabled?: boolean;
  display_name_override?: string | null;
  description_override?: string | null;
  metadata_json?: Record<string, unknown>;
};
const result = (row: typeof preferences.$inferSelect) => ({
  ...instancePreferenceIdentity(row),
  ...(row.value as SkillValue),
  skill_key: row.key.slice("skill:".length),
});
export const createExtensionSkillPreferencesDBService = (db: DbClient) => ({
  async list(projectId: string, instanceId?: string) {
    return (
      await db
        .select()
        .from(preferences)
        .where(instancePreferenceWhere(projectId, instanceId, "skill"))
        .orderBy(preferences.key)
    ).map(result);
  },
  async get(projectId: string, instanceId: string, skillKey: string) {
    const [row] = await db
      .select()
      .from(preferences)
      .where(instancePreferenceWhere(projectId, instanceId, "skill", skillKey));
    return row ? result(row) : null;
  },
  async set(input: SetSkillPreferenceInput) {
    return db.transaction(async (tx) => {
      const owner = await instancePreferenceOwner(tx, input.project_id, input.extension_instance_id);
      const stamp = new Date().toISOString();
      const { project_id: _project, extension_instance_id: _instance, skill_key: _key, ...values } = input;
      const patch = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
      const [row] = await tx
        .insert(preferences)
        .values({
          ...owner,
          project_id: input.project_id,
          key: `skill:${input.skill_key}`,
          sync: "team",
          value: {
            enabled: true,
            display_name_override: null,
            description_override: null,
            metadata_json: {},
            ...patch,
            created_at: stamp,
          },
          updated_at: stamp,
        })
        .onConflictDoUpdate({
          target: [preferences.scope, preferences.scope_id, preferences.extension_id, preferences.key],
          set: { value: sql`${preferences.value} || ${JSON.stringify(patch)}::jsonb`, updated_at: stamp },
        })
        .returning();
      return result(row!);
    });
  },
  async remove(projectId: string, instanceId: string, skillKey: string) {
    return (
      (
        await db
          .delete(preferences)
          .where(instancePreferenceWhere(projectId, instanceId, "skill", skillKey))
          .returning({ key: preferences.key })
      ).length > 0
    );
  },
});
