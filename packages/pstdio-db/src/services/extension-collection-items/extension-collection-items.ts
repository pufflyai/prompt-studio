import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_collection_items } from "../../db/schemas.pg";

type ItemKey = {
  project_id: string;
  extension_id: string;
  namespace: string;
  scope_type: string;
  scope_id: string;
  collection: string;
  item_id: string;
};

type SetInput = ItemKey & { value: unknown };

type ListCollectionInput = {
  project_id: string;
  extension_id: string;
  collection: string;
  scope_type?: string;
  scope_id?: string;
};

const nowTimestamp = () => new Date().toISOString();

const matchItem = (input: ItemKey) =>
  and(
    eq(extension_collection_items.project_id, input.project_id),
    eq(extension_collection_items.extension_id, input.extension_id),
    eq(extension_collection_items.scope_type, input.scope_type),
    eq(extension_collection_items.scope_id, input.scope_id),
    eq(extension_collection_items.collection, input.collection),
    eq(extension_collection_items.item_id, input.item_id),
  );

export const createExtensionCollectionItemsDBService = (db: DbClient) => {
  const get = async (input: ItemKey) => {
    const [row] = await db.select().from(extension_collection_items).where(matchItem(input));
    return row ? (row.value_json as unknown) : null;
  };

  const set = async (input: SetInput) => {
    const timestamp = nowTimestamp();

    await db
      .insert(extension_collection_items)
      .values({
        project_id: input.project_id,
        extension_id: input.extension_id,
        namespace: input.namespace,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        collection: input.collection,
        item_id: input.item_id,
        value_json: input.value,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [
          extension_collection_items.project_id,
          extension_collection_items.extension_id,
          extension_collection_items.scope_type,
          extension_collection_items.scope_id,
          extension_collection_items.collection,
          extension_collection_items.item_id,
        ],
        set: {
          value_json: input.value,
          namespace: input.namespace,
          updated_at: timestamp,
        },
      });
  };

  const delete_ = async (input: ItemKey) => {
    const result = await db
      .delete(extension_collection_items)
      .where(matchItem(input))
      .returning({ item_id: extension_collection_items.item_id });
    return result.length > 0;
  };

  const listCollection = async (input: ListCollectionInput) => {
    const conditions = [
      eq(extension_collection_items.project_id, input.project_id),
      eq(extension_collection_items.extension_id, input.extension_id),
      eq(extension_collection_items.collection, input.collection),
    ];

    if (input.scope_type !== undefined) {
      conditions.push(eq(extension_collection_items.scope_type, input.scope_type));
    }
    if (input.scope_id !== undefined) {
      conditions.push(eq(extension_collection_items.scope_id, input.scope_id));
    }

    return db
      .select()
      .from(extension_collection_items)
      .where(and(...conditions))
      .orderBy(extension_collection_items.item_id);
  };

  return { get, set, delete: delete_, listCollection };
};
