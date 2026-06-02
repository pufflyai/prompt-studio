import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_collection_items, extension_kv } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

export type KvScope = {
  extension_instance_id: string;
  scope_type: string;
  scope_id: string;
};

export type CollectionScope = KvScope & { collection: string };

export type SetKvInput = KvScope & {
  key: string;
  value_json: unknown;
  project_id?: string | null;
};

export type SetCollectionItemInput = CollectionScope & {
  item_id: string;
  value_json: unknown;
  sort_order?: number | null;
  project_id?: string | null;
};

export const createExtensionStorageDBService = (db: DbClient) => {
  const getKv = async (scope: KvScope, key: string) => {
    const [row] = await db
      .select()
      .from(extension_kv)
      .where(
        and(
          eq(extension_kv.extension_instance_id, scope.extension_instance_id),
          eq(extension_kv.scope_type, scope.scope_type),
          eq(extension_kv.scope_id, scope.scope_id),
          eq(extension_kv.key, key),
        ),
      );
    return row ?? null;
  };

  const listKv = async (scope: KvScope) =>
    db
      .select()
      .from(extension_kv)
      .where(
        and(
          eq(extension_kv.extension_instance_id, scope.extension_instance_id),
          eq(extension_kv.scope_type, scope.scope_type),
          eq(extension_kv.scope_id, scope.scope_id),
        ),
      )
      .orderBy(extension_kv.key);

  const setKv = async (input: SetKvInput) => {
    const timestamp = nowTimestamp();
    const row = {
      project_id: input.project_id ?? null,
      extension_instance_id: input.extension_instance_id,
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      key: input.key,
      value_json: input.value_json,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const [stored] = await db
      .insert(extension_kv)
      .values(row)
      .onConflictDoUpdate({
        target: [extension_kv.extension_instance_id, extension_kv.scope_type, extension_kv.scope_id, extension_kv.key],
        set: { value_json: input.value_json, project_id: input.project_id ?? null, updated_at: timestamp },
      })
      .returning();
    return stored;
  };

  const deleteKv = async (scope: KvScope, key: string) => {
    const deleted = await db
      .delete(extension_kv)
      .where(
        and(
          eq(extension_kv.extension_instance_id, scope.extension_instance_id),
          eq(extension_kv.scope_type, scope.scope_type),
          eq(extension_kv.scope_id, scope.scope_id),
          eq(extension_kv.key, key),
        ),
      )
      .returning({ key: extension_kv.key });
    return deleted.length > 0;
  };

  const listCollection = async (scope: CollectionScope) =>
    db
      .select()
      .from(extension_collection_items)
      .where(
        and(
          eq(extension_collection_items.extension_instance_id, scope.extension_instance_id),
          eq(extension_collection_items.scope_type, scope.scope_type),
          eq(extension_collection_items.scope_id, scope.scope_id),
          eq(extension_collection_items.collection, scope.collection),
        ),
      )
      .orderBy(extension_collection_items.sort_order, extension_collection_items.item_id);

  const getCollectionItem = async (scope: CollectionScope, itemId: string) => {
    const [row] = await db
      .select()
      .from(extension_collection_items)
      .where(
        and(
          eq(extension_collection_items.extension_instance_id, scope.extension_instance_id),
          eq(extension_collection_items.scope_type, scope.scope_type),
          eq(extension_collection_items.scope_id, scope.scope_id),
          eq(extension_collection_items.collection, scope.collection),
          eq(extension_collection_items.item_id, itemId),
        ),
      );
    return row ?? null;
  };

  const setCollectionItem = async (input: SetCollectionItemInput) => {
    const timestamp = nowTimestamp();
    const row = {
      project_id: input.project_id ?? null,
      extension_instance_id: input.extension_instance_id,
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      collection: input.collection,
      item_id: input.item_id,
      sort_order: input.sort_order ?? null,
      value_json: input.value_json,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const [stored] = await db
      .insert(extension_collection_items)
      .values(row)
      .onConflictDoUpdate({
        target: [
          extension_collection_items.extension_instance_id,
          extension_collection_items.scope_type,
          extension_collection_items.scope_id,
          extension_collection_items.collection,
          extension_collection_items.item_id,
        ],
        set: {
          value_json: input.value_json,
          sort_order: input.sort_order ?? null,
          project_id: input.project_id ?? null,
          updated_at: timestamp,
        },
      })
      .returning();
    return stored;
  };

  const deleteCollectionItem = async (scope: CollectionScope, itemId: string) => {
    const deleted = await db
      .delete(extension_collection_items)
      .where(
        and(
          eq(extension_collection_items.extension_instance_id, scope.extension_instance_id),
          eq(extension_collection_items.scope_type, scope.scope_type),
          eq(extension_collection_items.scope_id, scope.scope_id),
          eq(extension_collection_items.collection, scope.collection),
          eq(extension_collection_items.item_id, itemId),
        ),
      )
      .returning({ item_id: extension_collection_items.item_id });
    return deleted.length > 0;
  };

  return { getKv, listKv, setKv, deleteKv, listCollection, getCollectionItem, setCollectionItem, deleteCollectionItem };
};
