import { and, eq, inArray } from "drizzle-orm";
import { createRecordStorage, type GroupedState, storageRecordId } from "pstdio-sync";
import type { Json, StorageGroup } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  extension_collection_items,
  extension_instances,
  extension_kv,
  installed_extension_sources,
} from "../../db/schemas.pg";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Import and remove old rows under the same owner lock as every later write. */
export const importLegacyStorage = async (tx: Transaction, state: GroupedState, environmentId: string) => {
  const instances = await tx
    .select({ id: extension_instances.id })
    .from(extension_instances)
    .innerJoin(
      installed_extension_sources,
      eq(extension_instances.installed_extension_id, installed_extension_sources.id),
    )
    .where(
      and(
        eq(extension_instances.scope_type, "project"),
        eq(extension_instances.scope_id, state.owner.workbenchId),
        eq(installed_extension_sources.extension_id, state.owner.extensionId),
      ),
    )
    .orderBy(extension_instances.id);
  if (!instances.length) return;
  const ids = instances.map((instance) => instance.id);
  const kv = await tx.select().from(extension_kv).where(inArray(extension_kv.extension_instance_id, ids));
  const collections = await tx
    .select()
    .from(extension_collection_items)
    .where(inArray(extension_collection_items.extension_instance_id, ids));
  if (!kv.length && !collections.length) return;
  const records = createRecordStorage({
    owner: state.owner,
    environmentId,
    store: { transaction: async (_owner, action) => action(state) },
  }).records;
  const groups = new Map<string, StorageGroup>();
  const add = async (instanceId: string, recordId: string, value: Json) => {
    const group = groups.get(instanceId) ?? { operationId: `legacy-import:${instanceId}`, edits: [] };
    group.edits.push({ recordId, expectedRevision: (await records.read(recordId)).revision, replace: value });
    groups.set(instanceId, group);
  };
  for (const row of kv)
    await add(
      row.extension_instance_id,
      storageRecordId([row.scope_type, row.scope_id, "kv"], row.key),
      row.value_json as Json,
    );
  for (const row of collections)
    await add(
      row.extension_instance_id,
      storageRecordId([row.scope_type, row.scope_id, "collection", row.collection], row.item_id),
      { value: row.value_json as Json, sortOrder: row.sort_order },
    );
  for (const group of groups.values()) await records.commit(group);
  await tx.delete(extension_kv).where(inArray(extension_kv.extension_instance_id, ids));
  await tx.delete(extension_collection_items).where(inArray(extension_collection_items.extension_instance_id, ids));
};
