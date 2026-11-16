import type { StorageRecord } from "pstdio-sync-contracts";
import type { OrderedObservation } from "./ordered-operation";
import type { GroupCommit } from "./types";

export const storageRecordId = (namespace: string[], recordId: string) => JSON.stringify([...namespace, recordId]);

/** Address prefix shared by every item of a deprecated collection. */
export const collectionRecordPrefix = (scopeType: string, scopeId: string, name: string) =>
  `${JSON.stringify([scopeType, scopeId, "collection", name]).slice(0, -1)},`;

/** Host record that names the record key prefix a moved collection's items live under. */
export const collectionMoveMarkerId = (scopeType: string, scopeId: string, name: string) =>
  JSON.stringify([scopeType, scopeId, "collection-moved", name]);

/** Address prefix of the records whose `records.id` key starts with `keyPrefix`. */
export const recordKeyPrefix = (scopeType: string, scopeId: string, keyPrefix: string) =>
  JSON.stringify([scopeType, scopeId, "kv", keyPrefix]).slice(0, -2);

export const scopeRecordStorage = <Records extends object>(records: Records, namespace: string[]) => {
  return { id: (key: string) => storageRecordId(namespace, key), ...records };
};

// Logical keys are a compatibility concern. Public record IDs always retain their full address.
interface NamespacedRecords {
  read(id: string): Promise<StorageRecord>;
  list?(prefix: string): Promise<StorageRecord[]>;
  commit(group: GroupCommit): Promise<unknown>;
}

export const legacyNamespaceStorage = (records: NamespacedRecords, namespace: string[]) => {
  const prefix = `${JSON.stringify(namespace).slice(0, -1)},`;
  const storedId = (id: string) => storageRecordId(namespace, id);
  return {
    read: (id: string) => records.read(storedId(id)),
    list: async () =>
      (await records.list!(prefix)).map((record) => ({
        ...record,
        recordId: (JSON.parse(record.recordId) as string[]).at(-1)!,
      })),
    commit: (group: GroupCommit) =>
      records.commit({
        ...group,
        edits: group.edits.map((edit) => ({ ...edit, recordId: storedId(edit.recordId) })),
      }),
  };
};

/** An observation of an absent record: a save conditioned on it is refused once the record exists. */
export const initialRecordRevision = () =>
  JSON.stringify({
    version: 1,
    exists: false,
    deleted: false,
    lifetime: null,
    value: { kind: "object", fields: {} },
    stamps: {},
  } satisfies OrderedObservation);
