import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import {
  extension_collection_items,
  extension_instances,
  extension_kv,
  extension_skill_preferences,
  extension_template_preferences,
} from "../../db/schemas.extensions.pg";

type ExtensionInstanceRecord = typeof extension_instances.$inferSelect;
type ExtensionInstanceCreateInput = {
  project_id: string;
  extension_id: string;
  display_name: string;
  source_kind: ExtensionInstanceRecord["source_kind"];
  package_name?: string | null;
  package_version?: string | null;
  local_path?: string | null;
  config_json?: Record<string, unknown>;
  enabled?: boolean;
};
type ExtensionInstanceUpdateInput = Partial<
  Pick<
    ExtensionInstanceRecord,
    "display_name" | "package_name" | "package_version" | "local_path" | "enabled" | "config_json"
  >
>;

type ExtensionStorageScope = {
  project_id: string;
  extension_id: string;
  scope_type: string;
  scope_id: string;
};

const nowTimestamp = () => new Date().toISOString();

const kvWhere = (scope: ExtensionStorageScope, key: string) =>
  and(
    eq(extension_kv.project_id, scope.project_id),
    eq(extension_kv.extension_id, scope.extension_id),
    eq(extension_kv.scope_type, scope.scope_type),
    eq(extension_kv.scope_id, scope.scope_id),
    eq(extension_kv.key, key),
  );

const collectionWhere = (scope: ExtensionStorageScope, collection: string, itemId: string) =>
  and(
    eq(extension_collection_items.project_id, scope.project_id),
    eq(extension_collection_items.extension_id, scope.extension_id),
    eq(extension_collection_items.scope_type, scope.scope_type),
    eq(extension_collection_items.scope_id, scope.scope_id),
    eq(extension_collection_items.collection, collection),
    eq(extension_collection_items.item_id, itemId),
  );

const templatePreferenceWhere = (projectId: string, extensionId: string, templateKey: string) =>
  and(
    eq(extension_template_preferences.project_id, projectId),
    eq(extension_template_preferences.extension_id, extensionId),
    eq(extension_template_preferences.template_key, templateKey),
  );

const skillPreferenceWhere = (projectId: string, extensionId: string, skillKey: string) =>
  and(
    eq(extension_skill_preferences.project_id, projectId),
    eq(extension_skill_preferences.extension_id, extensionId),
    eq(extension_skill_preferences.skill_key, skillKey),
  );

export const createExtensionInstancesDBService = (db: DbClient) => {
  const list = async (projectId: string) =>
    db
      .select()
      .from(extension_instances)
      .where(eq(extension_instances.project_id, projectId))
      .orderBy(extension_instances.extension_id);

  const get = async (projectId: string, extensionId: string) => {
    const [instance] = await db
      .select()
      .from(extension_instances)
      .where(and(eq(extension_instances.project_id, projectId), eq(extension_instances.extension_id, extensionId)));
    return instance ?? null;
  };

  const create = async (input: ExtensionInstanceCreateInput) => {
    const timestamp = nowTimestamp();
    const record: ExtensionInstanceRecord = {
      ...input,
      id: crypto.randomUUID(),
      enabled: input.enabled ?? true,
      package_name: input.package_name ?? null,
      package_version: input.package_version ?? null,
      local_path: input.local_path ?? null,
      config_json: input.config_json ?? {},
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(extension_instances).values(record);
    return record;
  };

  const update = async (projectId: string, extensionId: string, input: ExtensionInstanceUpdateInput) => {
    const existing = await get(projectId, extensionId);
    if (!existing) return null;

    const updated: ExtensionInstanceRecord = {
      ...existing,
      ...input,
      updated_at: nowTimestamp(),
    };

    await db
      .update(extension_instances)
      .set({
        display_name: updated.display_name,
        package_name: updated.package_name,
        package_version: updated.package_version,
        local_path: updated.local_path,
        enabled: updated.enabled,
        config_json: updated.config_json,
        updated_at: updated.updated_at,
      })
      .where(eq(extension_instances.id, existing.id));

    return updated;
  };

  const enable = async (projectId: string, extensionId: string) => update(projectId, extensionId, { enabled: true });
  const disable = async (projectId: string, extensionId: string) => update(projectId, extensionId, { enabled: false });

  return { list, get, create, update, enable, disable };
};

export const createExtensionStorageDBService = (db: DbClient) => {
  const get = async (scope: ExtensionStorageScope, key: string) => {
    const [record] = await db.select().from(extension_kv).where(kvWhere(scope, key));
    return record?.value_json ?? null;
  };

  const set = async (scope: ExtensionStorageScope, key: string, value: unknown) => {
    const timestamp = nowTimestamp();
    const [existing] = await db.select().from(extension_kv).where(kvWhere(scope, key));

    if (existing) {
      const updated = { ...existing, value_json: value, updated_at: timestamp };
      await db
        .update(extension_kv)
        .set({ value_json: value, updated_at: timestamp })
        .where(eq(extension_kv.id, existing.id));
      return updated;
    }

    const record: typeof extension_kv.$inferSelect = {
      ...scope,
      id: crypto.randomUUID(),
      key,
      value_json: value,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(extension_kv).values(record);
    return record;
  };

  const deleteKey = async (scope: ExtensionStorageScope, key: string) => {
    const [existing] = await db.select().from(extension_kv).where(kvWhere(scope, key));
    await db.delete(extension_kv).where(kvWhere(scope, key));
    return existing ?? null;
  };

  const collection = (scope: ExtensionStorageScope, collectionName: string) => {
    const listRecords = async () =>
      db
        .select()
        .from(extension_collection_items)
        .where(
          and(
            eq(extension_collection_items.project_id, scope.project_id),
            eq(extension_collection_items.extension_id, scope.extension_id),
            eq(extension_collection_items.scope_type, scope.scope_type),
            eq(extension_collection_items.scope_id, scope.scope_id),
            eq(extension_collection_items.collection, collectionName),
          ),
        )
        .orderBy(extension_collection_items.item_id);

    const list = async () => {
      const rows = await listRecords();
      return rows.map((row) => ({ id: row.item_id, value: row.value_json }));
    };

    const get = async (itemId: string) => {
      const [record] = await db
        .select()
        .from(extension_collection_items)
        .where(collectionWhere(scope, collectionName, itemId));
      return record?.value_json ?? null;
    };

    const put = async (itemId: string, value: unknown) => {
      const timestamp = nowTimestamp();
      const [existing] = await db
        .select()
        .from(extension_collection_items)
        .where(collectionWhere(scope, collectionName, itemId));

      if (existing) {
        const updated = { ...existing, value_json: value, updated_at: timestamp };
        await db
          .update(extension_collection_items)
          .set({ value_json: value, updated_at: timestamp })
          .where(eq(extension_collection_items.id, existing.id));
        return updated;
      }

      const record: typeof extension_collection_items.$inferSelect = {
        ...scope,
        id: crypto.randomUUID(),
        collection: collectionName,
        item_id: itemId,
        value_json: value,
        created_at: timestamp,
        updated_at: timestamp,
      };

      await db.insert(extension_collection_items).values(record);
      return record;
    };

    const deleteItem = async (itemId: string) => {
      const [existing] = await db
        .select()
        .from(extension_collection_items)
        .where(collectionWhere(scope, collectionName, itemId));
      await db.delete(extension_collection_items).where(collectionWhere(scope, collectionName, itemId));
      return existing ?? null;
    };

    return { list, listRecords, get, put, delete: deleteItem };
  };

  return { get, set, delete: deleteKey, collection };
};

export const createExtensionTemplatePreferencesDBService = (db: DbClient) => {
  const get = async (projectId: string, extensionId: string, templateKey: string) => {
    const [preference] = await db
      .select()
      .from(extension_template_preferences)
      .where(templatePreferenceWhere(projectId, extensionId, templateKey));
    return preference ?? null;
  };

  const isEnabled = async (projectId: string, extensionId: string, templateKey: string) =>
    (await get(projectId, extensionId, templateKey))?.enabled ?? true;

  const setEnabled = async (projectId: string, extensionId: string, templateKey: string, enabled: boolean) => {
    const timestamp = nowTimestamp();
    const existing = await get(projectId, extensionId, templateKey);

    if (existing) {
      await db
        .update(extension_template_preferences)
        .set({ enabled, updated_at: timestamp })
        .where(eq(extension_template_preferences.id, existing.id));
      return { ...existing, enabled, updated_at: timestamp };
    }

    const record: typeof extension_template_preferences.$inferSelect = {
      id: crypto.randomUUID(),
      project_id: projectId,
      extension_id: extensionId,
      template_key: templateKey,
      enabled,
      updated_at: timestamp,
    };

    await db.insert(extension_template_preferences).values(record);
    return record;
  };

  return { get, isEnabled, setEnabled };
};

export const createExtensionSkillPreferencesDBService = (db: DbClient) => {
  const get = async (projectId: string, extensionId: string, skillKey: string) => {
    const [preference] = await db
      .select()
      .from(extension_skill_preferences)
      .where(skillPreferenceWhere(projectId, extensionId, skillKey));
    return preference ?? null;
  };

  const isEnabled = async (projectId: string, extensionId: string, skillKey: string) =>
    (await get(projectId, extensionId, skillKey))?.enabled ?? true;

  const setEnabled = async (projectId: string, extensionId: string, skillKey: string, enabled: boolean) => {
    const timestamp = nowTimestamp();
    const existing = await get(projectId, extensionId, skillKey);

    if (existing) {
      await db
        .update(extension_skill_preferences)
        .set({ enabled, updated_at: timestamp })
        .where(eq(extension_skill_preferences.id, existing.id));
      return { ...existing, enabled, updated_at: timestamp };
    }

    const record: typeof extension_skill_preferences.$inferSelect = {
      id: crypto.randomUUID(),
      project_id: projectId,
      extension_id: extensionId,
      skill_key: skillKey,
      enabled,
      updated_at: timestamp,
    };

    await db.insert(extension_skill_preferences).values(record);
    return record;
  };

  return { get, isEnabled, setEnabled };
};
