import type { createDocumentStorage } from "./document-storage";
import { encodeText } from "./encoding";
import type { StorageOwner } from "./types";

export const storageRecordId = (namespace: string[], recordId: string) => JSON.stringify([...namespace, recordId]);

export const scopeRecordStorage = (
  records: ReturnType<typeof createDocumentStorage>["records"],
  namespace: string[],
) => {
  return { id: (key: string) => storageRecordId(namespace, key), ...records };
};

// Logical keys are a compatibility concern. Public record IDs always retain their full address.
export const legacyNamespaceStorage = (
  records: ReturnType<typeof createDocumentStorage>["records"],
  namespace: string[],
) => {
  const prefix = `${JSON.stringify(namespace).slice(0, -1)},`;
  const storedId = (id: string) => storageRecordId(namespace, id);
  return {
    read: (id: string) => records.read(storedId(id)),
    list: async () =>
      (await records.list(prefix)).map((record) => ({
        ...record,
        recordId: (JSON.parse(record.recordId) as string[]).at(-1)!,
      })),
    commit: (group: Parameters<typeof records.commit>[0]) =>
      records.commit({
        ...group,
        edits: group.edits.map((edit) => ({ ...edit, recordId: storedId(edit.recordId) })),
      }),
  };
};

export const initialRecordRevision = (owner: StorageOwner, recordId: string) =>
  encodeText(JSON.stringify({ owner, recordId, operations: [] }));
