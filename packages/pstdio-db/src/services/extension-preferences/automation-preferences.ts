import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_automation_preferences } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export type SetAutomationPreferenceInput = {
  project_id: string;
  extension_instance_id: string;
  automation_id: string;
  enabled: boolean;
};

export const createExtensionAutomationPreferencesDBService = (db: DbClient) => {
  const list = async (projectId: string, extensionInstanceId?: string) => {
    const conditions = [eq(extension_automation_preferences.project_id, projectId)];
    if (extensionInstanceId) {
      conditions.push(eq(extension_automation_preferences.extension_instance_id, extensionInstanceId));
    }
    return db
      .select()
      .from(extension_automation_preferences)
      .where(and(...conditions))
      .orderBy(extension_automation_preferences.automation_id);
  };

  const get = async (projectId: string, extensionInstanceId: string, automationId: string) => {
    const [row] = await db
      .select()
      .from(extension_automation_preferences)
      .where(
        and(
          eq(extension_automation_preferences.project_id, projectId),
          eq(extension_automation_preferences.extension_instance_id, extensionInstanceId),
          eq(extension_automation_preferences.automation_id, automationId),
        ),
      );
    return row ?? null;
  };

  const set = async (input: SetAutomationPreferenceInput) => {
    const timestamp = nowTimestamp();
    const existing = await get(input.project_id, input.extension_instance_id, input.automation_id);

    if (existing) {
      await db
        .update(extension_automation_preferences)
        .set({ enabled: input.enabled, updated_at: timestamp })
        .where(
          and(
            eq(extension_automation_preferences.project_id, input.project_id),
            eq(extension_automation_preferences.extension_instance_id, input.extension_instance_id),
            eq(extension_automation_preferences.automation_id, input.automation_id),
          ),
        );
      return { ...existing, enabled: input.enabled, updated_at: timestamp };
    }

    const row = {
      project_id: input.project_id,
      extension_instance_id: input.extension_instance_id,
      automation_id: input.automation_id,
      enabled: input.enabled,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await db.insert(extension_automation_preferences).values(row);
    return row;
  };

  const remove = async (projectId: string, extensionInstanceId: string, automationId: string) => {
    const deleted = await db
      .delete(extension_automation_preferences)
      .where(
        and(
          eq(extension_automation_preferences.project_id, projectId),
          eq(extension_automation_preferences.extension_instance_id, extensionInstanceId),
          eq(extension_automation_preferences.automation_id, automationId),
        ),
      )
      .returning({ automation_id: extension_automation_preferences.automation_id });
    return deleted.length > 0;
  };

  return { list, get, set, remove };
};
