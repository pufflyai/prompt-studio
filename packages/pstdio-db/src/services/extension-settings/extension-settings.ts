import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_settings } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export type ExtensionSettingOwnerType = "installed_extension" | "extension_instance";

export type ExtensionSettingOwner = {
  owner_type: ExtensionSettingOwnerType;
  owner_id: string;
  extension_id: string;
};

export type ExtensionSettingKey = ExtensionSettingOwner & {
  key: string;
};

export type SetExtensionSettingInput = ExtensionSettingKey & {
  value_json: unknown;
};

export const createExtensionSettingsDBService = (db: DbClient) => {
  const whereKey = (input: ExtensionSettingKey) =>
    and(
      eq(extension_settings.owner_type, input.owner_type),
      eq(extension_settings.owner_id, input.owner_id),
      eq(extension_settings.extension_id, input.extension_id),
      eq(extension_settings.key, input.key),
    );

  const getValue = async (input: ExtensionSettingKey) => {
    const [row] = await db.select().from(extension_settings).where(whereKey(input));
    return row ?? null;
  };

  const listValues = async (owner: ExtensionSettingOwner) =>
    db
      .select()
      .from(extension_settings)
      .where(
        and(
          eq(extension_settings.owner_type, owner.owner_type),
          eq(extension_settings.owner_id, owner.owner_id),
          eq(extension_settings.extension_id, owner.extension_id),
        ),
      )
      .orderBy(extension_settings.key);

  const setValue = async (input: SetExtensionSettingInput) => {
    const timestamp = nowTimestamp();
    const row = {
      owner_type: input.owner_type,
      owner_id: input.owner_id,
      extension_id: input.extension_id,
      key: input.key,
      value_json: input.value_json,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const [stored] = await db
      .insert(extension_settings)
      .values(row)
      .onConflictDoUpdate({
        target: [
          extension_settings.owner_type,
          extension_settings.owner_id,
          extension_settings.extension_id,
          extension_settings.key,
        ],
        set: { value_json: input.value_json, updated_at: timestamp },
      })
      .returning();
    return stored;
  };

  const deleteValue = async (input: ExtensionSettingKey) => {
    const deleted = await db
      .delete(extension_settings)
      .where(whereKey(input))
      .returning({ key: extension_settings.key });
    return deleted.length > 0;
  };

  return { getValue, listValues, setValue, deleteValue };
};
