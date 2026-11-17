import { canonicalJson, fingerprint, type Json, type StorageRecord } from "pstdio-sync-contracts";
import { collectionMoveMarkerId, collectionRecordPrefix, recordKeyPrefix, storageRecordId } from "./namespaces";
import type { GroupCommit } from "./types";

interface LegacyCollectionValue {
  value: Json;
  sortOrder: number | null;
}

interface Reader {
  read(id: string): Promise<StorageRecord>;
}

export interface LegacyCollectionRecords extends Reader {
  list(prefix: string): Promise<StorageRecord[]>;
  /** Runs reads and commits under one owner lock. */
  transaction<T>(run: (records: Reader & { commit(group: GroupCommit): Promise<unknown> }) => Promise<T>): Promise<T>;
}

// Legacy SQL JSON writes omitted undefined object fields and used null for undefined array entries.
export const legacyJson = (value: Json) => JSON.parse(JSON.stringify(value)) as Json;

const collectionRevision = (record: StorageRecord) =>
  fingerprint({
    revision: record.revision,
    lifetime: "recordLifetime" in record ? String(record.recordLifetime) : null,
  });

const live = (record: StorageRecord) => record.exists && !record.deleted;
const lastKey = (recordId: string) => (JSON.parse(recordId) as string[]).at(-1)!;

/**
 * Deprecated collection items. After `migration.moveCollection`, items not yet moved stay at their
 * collection address; moved and new items live at `records.id(keyPrefix + id)` without the envelope.
 */
export const createLegacyCollection = (
  records: LegacyCollectionRecords,
  scope: { scopeType: string; scopeId: string },
  name: string,
) => {
  const { scopeType, scopeId } = scope;
  const itemId = (id: string) => storageRecordId([scopeType, scopeId, "collection", name], id);
  const movedPrefix = async (reader: Reader) => {
    const marker = await reader.read(collectionMoveMarkerId(scopeType, scopeId, name));
    return live(marker) ? ((marker.value as { keyPrefix?: string }).keyPrefix ?? undefined) : undefined;
  };
  const locate = async (reader: Reader, id: string) => {
    const record = await reader.read(itemId(id));
    const prefix = live(record) ? undefined : await movedPrefix(reader);
    if (prefix === undefined) return { recordId: itemId(id), record, wrapped: true };
    const recordId = storageRecordId([scopeType, scopeId, "kv"], prefix + id);
    return { recordId, record: await reader.read(recordId), wrapped: false };
  };
  type Location = Awaited<ReturnType<typeof locate>>;
  const stored = (location: Location): LegacyCollectionValue =>
    location.wrapped
      ? (location.record.value as unknown as LegacyCollectionValue)
      : { value: location.record.value as Json, sortOrder: null };
  const wrap = (location: Location, value: Json, sortOrder: number | null) =>
    location.wrapped ? { value: legacyJson(value), sortOrder } : legacyJson(value);
  const save = (
    writer: { commit(group: GroupCommit): Promise<unknown> },
    location: Location,
    value: Json,
    deleted = false,
  ) =>
    writer.commit({
      operationId: crypto.randomUUID(),
      edits: [
        {
          recordId: location.recordId,
          ...(deleted
            ? { expectedRevision: location.record.revision }
            : { observedRevision: location.record.revision, expectedLifetime: location.record.revision }),
          replace: value,
          ...(location.record.deleted !== deleted && { deleted }),
        },
      ],
    });
  const update = (id: string, value: Json, revision?: string) =>
    // Read and change only the payload within the same owner lock.
    records.transaction(async (writer) => {
      const location = await locate(writer, id);
      if (!live(location.record)) return false;
      if (revision !== undefined && (await collectionRevision(location.record)) !== revision) return false;
      // The boolean condition was checked under this local owner lock. Reuse its baseline
      // without later refusing the accepted save at relay order.
      await save(writer, location, wrap(location, value, stored(location).sortOrder));
      return true;
    });
  const createIfAbsent = (id: string, value: Json, sortOrder: number | null = null) =>
    records.transaction(async (writer) => {
      const location = await locate(writer, id);
      if (live(location.record)) return false;
      await save(writer, location, wrap(location, value, sortOrder));
      return true;
    });

  return {
    read: async (id: string) => {
      const location = await locate(records, id);
      if (!live(location.record)) return undefined;
      return { id, ...stored(location), revision: await collectionRevision(location.record) };
    },
    get: async (id: string) => {
      const location = await locate(records, id);
      return live(location.record) ? { id, ...stored(location) } : undefined;
    },
    list: async () => {
      const items = (await records.list(collectionRecordPrefix(scopeType, scopeId, name))).map((record) => ({
        id: lastKey(record.recordId),
        ...(record.value as unknown as LegacyCollectionValue),
      }));
      const prefix = await movedPrefix(records);
      // An item left in place because its target is taken, or moved between the two reads, keeps one
      // entry; the item at its collection address wins, like in get.
      const seen = new Set(items.map((item) => item.id));
      if (prefix !== undefined)
        for (const record of await records.list(recordKeyPrefix(scopeType, scopeId, prefix))) {
          const id = lastKey(record.recordId).slice(prefix.length);
          if (!seen.has(id)) items.push({ id, value: record.value as Json, sortOrder: null });
        }
      return items.sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) return (left.sortOrder ?? Infinity) - (right.sortOrder ?? Infinity);
        return left.id.localeCompare(right.id);
      });
    },
    set: (id: string, value: Json, sortOrder: number | null = null) =>
      records.transaction(async (writer) => {
        const location = await locate(writer, id);
        await save(writer, location, wrap(location, value, sortOrder));
      }),
    update: (id: string, value: Json) => update(id, value),
    updateIfUnchanged: (id: string, revision: string, value: Json) => {
      if (typeof revision !== "string") throw new TypeError("A collection observation revision is required");
      return update(id, value, revision);
    },
    createIfAbsent,
    delete: (id: string) =>
      records.transaction(async (writer) => {
        const location = await locate(writer, id);
        if (!live(location.record)) return false;
        await save(writer, location, location.record.value as Json, true);
        return true;
      }),
    deleteIfValue: (id: string, value: Json) =>
      records.transaction(async (writer) => {
        const location = await locate(writer, id);
        if (!live(location.record)) return false;
        if (canonicalJson(stored(location).value) !== canonicalJson(legacyJson(value))) return false;
        await writer.commit({
          operationId: crypto.randomUUID(),
          edits: [{ recordId: location.recordId, expectedRevision: location.record.revision, deleted: true }],
        });
        return true;
      }),
  };
};
