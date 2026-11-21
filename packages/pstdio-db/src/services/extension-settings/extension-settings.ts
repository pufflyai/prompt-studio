import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { preferences } from "../../db/schemas/preferences";
import { getExtensionStorageOwner } from "../extension-storage/storage-owner";
import { type ExtensionSettingOwner, extensionSettingPreferenceOwner } from "../preferences/preference-owners";
import { preferenceOwnerWhere } from "../preferences/preferences";

export type { ExtensionSettingOwner, ExtensionSettingOwnerType } from "../preferences/preference-owners";

export type ExtensionSettingKey = ExtensionSettingOwner & { key: string };
export type SetExtensionSettingInput = ExtensionSettingKey & { value_json: unknown };
interface StoredSetting {
  value: unknown;
  created_at: string;
}
const result = (row: typeof preferences.$inferSelect, owner: ExtensionSettingOwner) => ({
  ...owner,
  key: row.key.slice("setting:".length),
  value_json: (row.value as StoredSetting).value,
  created_at: (row.value as StoredSetting).created_at,
  updated_at: row.updated_at,
});
export const createExtensionSettingsDBService = (db: DbClient) => {
  const ownerWhere = (owner: ExtensionSettingOwner) => preferenceOwnerWhere(extensionSettingPreferenceOwner(owner));
  const whereKey = (input: ExtensionSettingKey) => and(ownerWhere(input), eq(preferences.key, `setting:${input.key}`));
  return {
    async getValue(input: ExtensionSettingKey) {
      const [row] = await db.select().from(preferences).where(whereKey(input));
      return row ? result(row, input) : null;
    },
    async listValues(owner: ExtensionSettingOwner) {
      const rows = await db
        .select()
        .from(preferences)
        .where(and(ownerWhere(owner), sql`starts_with(${preferences.key}, 'setting:')`))
        .orderBy(preferences.key);
      return rows.map((row) => result(row, owner));
    },
    async setValue(input: SetExtensionSettingInput) {
      const stamp = new Date().toISOString();
      let projectId: string | null = null;
      if (input.owner_type === "extension_instance")
        projectId = (await getExtensionStorageOwner(db, input.owner_id))?.workbenchId ?? null;
      let sync: "team" | "personal" | "device" = "personal";
      if (input.owner_type === "extension_instance") sync = "team";
      if (input.owner_type === "device_extension") sync = "device";
      const [row] = await db
        .insert(preferences)
        .values({
          ...extensionSettingPreferenceOwner(input),
          key: `setting:${input.key}`,
          project_id: projectId,
          sync,
          value: { value: input.value_json, created_at: stamp },
          updated_at: stamp,
        })
        .onConflictDoUpdate({
          target: [preferences.scope, preferences.scope_id, preferences.extension_id, preferences.key],
          set: {
            value: sql`jsonb_build_object('value', excluded.value->'value', 'created_at', ${preferences.value}->'created_at')`,
            updated_at: stamp,
          },
        })
        .returning();
      return result(row!, input);
    },
    async deleteValue(input: ExtensionSettingKey) {
      return (await db.delete(preferences).where(whereKey(input)).returning({ key: preferences.key })).length > 0;
    },
  };
};
