import { sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas/preferences";
import { instancePreferenceOwner } from "../preferences/preference-owners";
import { instancePreferenceIdentity, instancePreferenceWhere } from "./instance-preferences";
export type SetAutomationPreferenceInput = {
  project_id: string;
  extension_instance_id: string;
  automation_id: string;
  enabled: boolean;
};
interface AutomationValue {
  enabled: boolean;
  created_at: string;
}
const result = (row: typeof preferences.$inferSelect) => ({
  ...instancePreferenceIdentity(row),
  ...(row.value as AutomationValue),
  automation_id: row.key.slice("automation:".length),
});
export const createExtensionAutomationPreferencesDBService = (db: DbClient) => ({
  async list(projectId: string, instanceId?: string) {
    return (
      await db
        .select()
        .from(preferences)
        .where(instancePreferenceWhere(projectId, instanceId, "automation"))
        .orderBy(preferences.key)
    ).map(result);
  },
  async get(projectId: string, instanceId: string, automationId: string) {
    const [row] = await db
      .select()
      .from(preferences)
      .where(instancePreferenceWhere(projectId, instanceId, "automation", automationId));
    return row ? result(row) : null;
  },
  async set(input: SetAutomationPreferenceInput) {
    const owner = await instancePreferenceOwner(db, input.project_id, input.extension_instance_id);
    const stamp = new Date().toISOString();
    const [row] = await db
      .insert(preferences)
      .values({
        ...owner,
        project_id: input.project_id,
        key: `automation:${input.automation_id}`,
        sync: "team",
        value: { enabled: input.enabled, created_at: stamp },
        updated_at: stamp,
      })
      .onConflictDoUpdate({
        target: [preferences.scope, preferences.scope_id, preferences.extension_id, preferences.key],
        set: { value: sql`jsonb_set(${preferences.value}, '{enabled}', excluded.value->'enabled')`, updated_at: stamp },
      })
      .returning();
    return result(row!);
  },
  async remove(projectId: string, instanceId: string, automationId: string) {
    return (
      (
        await db
          .delete(preferences)
          .where(instancePreferenceWhere(projectId, instanceId, "automation", automationId))
          .returning({ key: preferences.key })
      ).length > 0
    );
  },
});
