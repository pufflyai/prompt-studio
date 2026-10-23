import type { StorageRecord } from "pstdio-sync-contracts";
import { encodeText } from "./encoding";
import type { GroupCommit, StorageOwner } from "./types";

export const storageRecordId = (namespace: string[], recordId: string) => JSON.stringify([...namespace, recordId]);

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

export const initialRecordRevision = (owner: StorageOwner, recordId: string) =>
  encodeText(JSON.stringify({ owner, recordId, operations: [] }));
