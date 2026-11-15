import type { Json, StorageRecord, StorageRecordIndex } from "pstdio-sync-contracts";
import { queryField, typedFieldValue } from "./record-query-field";

export type QueryIdentities = ReadonlyMap<string, { shorthand: string; aliases?: string[] }>;
export const queryIdentityKey = (kind: string, id: string) => JSON.stringify([kind, id]);
export const recordQueryIdentity = (index: StorageRecordIndex, record: StorageRecord, identities?: QueryIdentities) => {
  if (!index.identity) return undefined;
  const id = typedFieldValue(record.value, queryField(index, index.identity.idField), record.recordId);
  return typeof id === "string" ? identities?.get(queryIdentityKey(index.identity.kind, id)) : undefined;
};

/** This path is only the in-memory fixture engine; production selection joins the persisted core index. */
export const memoryQueryIdentities = async (
  indexes: StorageRecordIndex[],
  records: StorageRecord[],
  read?: (kind: string, id: string) => Promise<{ shorthand: string; aliases?: string[] } | null>,
) => {
  const identities = new Map<string, { shorthand: string; aliases?: string[] }>();
  if (!read) return identities;
  const keys = new Map<string, { kind: string; id: string }>();
  for (const index of indexes) {
    if (!index.identity) continue;
    for (const record of records) {
      if (record.deleted || (index.prefix !== undefined && !record.recordId.startsWith(index.prefix))) continue;
      const id: Json | undefined = typedFieldValue(
        record.value,
        queryField(index, index.identity.idField),
        record.recordId,
      );
      if (typeof id === "string")
        keys.set(queryIdentityKey(index.identity.kind, id), { kind: index.identity.kind, id });
    }
  }
  for (const [key, { kind, id }] of keys) {
    const found = await read(kind, id);
    if (found) identities.set(key, { shorthand: found.shorthand, aliases: found.aliases ?? [] });
  }
  return identities;
};
