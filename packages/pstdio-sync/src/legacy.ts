import { canonicalJson, type Json } from "pstdio-sync-contracts";
import { legacyNamespaceStorage } from "./namespaces";
import { createRecordStorage } from "./storage";
import type { GroupedStore, StorageOwner } from "./types";

interface LegacyCollectionValue {
  value: Json;
  sortOrder: number | null;
}

// Legacy SQL JSON writes omitted undefined object fields and used null for undefined array entries.
const legacyJson = (value: Json) => JSON.parse(JSON.stringify(value)) as Json;

/** Deprecated replacements deliberately observe the latest value inside the owner transaction. */
export const createLegacyRecordStorage = (input: {
  store: GroupedStore;
  owner: StorageOwner;
  environmentId: string;
}) => {
  const within = <T>(namespace: string[], action: (records: ReturnType<typeof legacyNamespaceStorage>) => Promise<T>) =>
    input.store.transaction(input.owner, (state) =>
      action(
        legacyNamespaceStorage(
          createRecordStorage({
            ...input,
            store: { transaction: async (_owner, run) => run(state), observer: input.store.observer },
          }).records,
          namespace,
        ),
      ),
    );

  const namespaceApi = (namespace: string[]) => {
    const read = (records: ReturnType<typeof legacyNamespaceStorage>, id: string) => records.read(id);
    const replace = async (
      records: ReturnType<typeof legacyNamespaceStorage>,
      id: string,
      value: Json,
      deleted = false,
    ) => {
      const current = await read(records, id);
      await records.commit({
        operationId: crypto.randomUUID(),
        edits: [
          {
            recordId: id,
            expectedRevision: current.revision,
            replace: legacyJson(value),
            ...(current.deleted !== deleted && { deleted }),
          },
        ],
      });
    };
    return {
      get: (id: string) =>
        within(namespace, async (records) => {
          const record = await read(records, id);
          return record.exists && !record.deleted ? record.value : undefined;
        }),
      list: () => within(namespace, (records) => records.list()),
      set: (id: string, value: Json) => within(namespace, (records) => replace(records, id, value)),
      createIfAbsent: (id: string, value: Json) =>
        within(namespace, async (records) => {
          const current = await read(records, id);
          if (current.exists && !current.deleted) return false;
          await replace(records, id, value);
          return true;
        }),
      delete: (id: string) =>
        within(namespace, async (records) => {
          const current = await read(records, id);
          if (!current.exists || current.deleted) return false;
          await replace(records, id, current.value, true);
          return true;
        }),
    };
  };
  return {
    scope: (scopeType: string, scopeId: string) => {
      const namespace = [scopeType, scopeId];
      return {
        kv: namespaceApi([...namespace, "kv"]),
        collection: (name: string) => {
          const items = namespaceApi([...namespace, "collection", name]);
          const valueFor = (value: Json, sortOrder: number | null) => ({ value, sortOrder });
          return {
            get: async (id: string) => {
              const stored = (await items.get(id)) as unknown as LegacyCollectionValue | undefined;
              return stored && { id, ...stored };
            },
            list: async () =>
              (await items.list())
                .map((record) => ({
                  id: record.recordId,
                  ...(record.value as unknown as LegacyCollectionValue),
                }))
                .sort((left, right) => {
                  if (left.sortOrder !== right.sortOrder)
                    return (left.sortOrder ?? Infinity) - (right.sortOrder ?? Infinity);
                  return left.id.localeCompare(right.id);
                }),
            set: (id: string, value: Json, sortOrder: number | null = null) =>
              items.set(id, valueFor(value, sortOrder)),
            update: async (id: string, value: Json) => {
              // Read and change only the payload within the same owner lock.
              return within([...namespace, "collection", name], async (records) => {
                const current = await records.read(id);
                if (!current.exists || current.deleted) return false;
                const stored = current.value as unknown as LegacyCollectionValue;
                await records.commit({
                  operationId: crypto.randomUUID(),
                  edits: [
                    {
                      recordId: id,
                      expectedRevision: current.revision,
                      replace: legacyJson(valueFor(value, stored.sortOrder)),
                    },
                  ],
                });
                return true;
              });
            },
            createIfAbsent: (id: string, value: Json, sortOrder: number | null = null) =>
              items.createIfAbsent(id, valueFor(value, sortOrder)),
            delete: items.delete,
            deleteIfValue: (id: string, value: Json) =>
              within([...namespace, "collection", name], async (records) => {
                const current = await records.read(id);
                if (!current.exists || current.deleted) return false;
                const stored = current.value as unknown as LegacyCollectionValue;
                if (canonicalJson(stored.value) !== canonicalJson(legacyJson(value))) return false;
                await records.commit({
                  operationId: crypto.randomUUID(),
                  edits: [
                    {
                      recordId: id,
                      expectedRevision: current.revision,
                      deleted: true,
                    },
                  ],
                });
                return true;
              }),
          };
        },
      };
    },
  };
};
