import type { Json, StorageRecord } from "pstdio-sync-contracts";
import { createLegacyCollection, legacyJson } from "./legacy-collection";
import { legacyNamespaceStorage } from "./namespaces";
import type { GroupCommit } from "./types";

interface LegacyRecords {
  read(id: string): Promise<StorageRecord>;
  list(prefix: string): Promise<StorageRecord[]>;
  commit(group: GroupCommit): Promise<unknown>;
  /** Runs reads and commits under one owner lock. */
  transaction<T>(
    run: (records: {
      read(id: string): Promise<StorageRecord>;
      commit(group: GroupCommit): Promise<unknown>;
    }) => Promise<T>,
  ): Promise<T>;
}

/** Deprecated replacements deliberately observe the latest value inside the owner lock. */
export const createLegacyRecordStorage = (input: { records: LegacyRecords }) => {
  const within = <T>(namespace: string[], action: (records: ReturnType<typeof legacyNamespaceStorage>) => Promise<T>) =>
    input.records.transaction((records) => action(legacyNamespaceStorage(records, namespace)));

  const namespaceApi = (namespace: string[]) => {
    const current = legacyNamespaceStorage(input.records, namespace);
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
            ...(deleted
              ? { expectedRevision: current.revision }
              : { observedRevision: current.revision, expectedLifetime: current.revision }),
            replace: legacyJson(value),
            ...(current.deleted !== deleted && { deleted }),
          },
        ],
      });
    };
    return {
      read: (id: string) => current.read(id),
      get: (id: string) =>
        current.read(id).then((record) => {
          return record.exists && !record.deleted ? record.value : undefined;
        }),
      list: () => current.list(),
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
        collection: (name: string) => createLegacyCollection(input.records, { scopeType, scopeId }, name),
      };
    },
  };
};
