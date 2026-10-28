import {
  fingerprint,
  type Json,
  type StorageRecord,
  type StorageRecordIndex,
  type StorageRecordQueries,
} from "pstdio-sync-contracts";
import type * as Y from "yjs";
import type { DocumentStore, StorageOwner } from "../shared";
import { readDocumentRecord } from "./document-record";
import {
  compareQueryValues,
  encodeQueryCursor,
  matchesPredicate,
  prepareRecordQuery,
  queryField,
  typedFieldValue,
  validateIndexes,
  validatePredicate,
} from "./record-query";

const definitions = new WeakMap<Y.Doc, Map<string, StorageRecordIndex>>();
const indexFor = (document: Y.Doc, name: string) => {
  const index = definitions.get(document)?.get(name);
  if (!index) throw new Error(`Storage index not installed: ${name}`);
  return index;
};

interface OrderedRecord {
  recordId: string;
  values: Json[];
}
const compareRecords = (index: StorageRecordIndex, left: OrderedRecord, right: OrderedRecord) => {
  for (const [position, sort] of (index.orderBy ?? []).entries()) {
    const a = left.values[position];
    const b = right.values[position];
    const order = compareQueryValues(a, b);
    if (!order) continue;
    if (a == null || b == null || sort.direction === "asc") return order;
    return -order;
  }
  if (left.recordId === right.recordId) return 0;
  return compareQueryValues(left.recordId, right.recordId);
};

export const createMemoryRecordQueries = (owner: StorageOwner, store: DocumentStore) => {
  const records = (document: Y.Doc) =>
    Promise.all([...document.getMap("records").keys()].map((id) => readDocumentRecord(document, id)));
  const api: StorageRecordQueries = {
    defineIndexes: async (indexes) => {
      validateIndexes(indexes);
      await store.transaction(owner, async ({ document }) => {
        definitions.set(document, new Map(indexes.map((index) => [index.name, structuredClone(index)])));
      });
    },
    readMany: (ids) =>
      store.transaction(owner, async ({ document }) => {
        if (ids.length > 100) throw new Error("A batch can read at most 100 records");
        return Promise.all(ids.map((id) => readDocumentRecord(document, id)));
      }),
    query: (query) =>
      store.transaction(owner, async ({ document }) => {
        const index = indexFor(document, query.index);
        const saved = await records(document);
        const revision = await fingerprint(saved as unknown as Json);
        const page = await prepareRecordQuery(owner, index, query, revision);
        const values = (record: StorageRecord) =>
          (index.orderBy ?? []).map((sort) => typedFieldValue(record.value, queryField(index, sort.field)) ?? null);
        const compare = (left: OrderedRecord, right: OrderedRecord) => compareRecords(index, left, right);
        const selected = saved
          .filter(
            (record) =>
              !record.deleted &&
              (index.prefix === undefined || record.recordId.startsWith(index.prefix)) &&
              matchesPredicate(index, record.value, query.where),
          )
          .map((record) => ({ record, recordId: record.recordId, values: values(record) }))
          .filter((record) => !page.after || compare(record, page.after) > 0)
          .sort(compare);
        const visible = selected.slice(page.offset, page.offset + page.limit);
        const last = visible.at(-1);
        return {
          revision,
          records: visible.map(({ record }) => ({
            recordId: record.recordId,
            revision: record.revision,
            fields: Object.fromEntries(
              page.fields.map((name) => [name, typedFieldValue(record.value, queryField(index, name)) ?? null]),
            ),
          })),
          cursor:
            last && selected.length > page.offset + page.limit
              ? encodeQueryCursor({ identity: page.identity, revision, recordId: last.recordId, values: last.values })
              : null,
        };
      }),
    aggregate: (query) =>
      store.transaction(owner, async ({ document }) => {
        const index = indexFor(document, query.index);
        validatePredicate(index, query.where);
        const saved = await records(document);
        const selected = saved.filter(
          (record) =>
            !record.deleted &&
            (index.prefix === undefined || record.recordId.startsWith(index.prefix)) &&
            matchesPredicate(index, record.value, query.where),
        );
        const groups = new Map<string, { value: Json; count: number }>();
        if (query.groupBy !== undefined)
          for (const record of selected) {
            const value = typedFieldValue(record.value, queryField(index, query.groupBy)) ?? null;
            const key = JSON.stringify(value);
            const group = groups.get(key) ?? { value, count: 0 };
            group.count++;
            groups.set(key, group);
          }
        return {
          revision: await fingerprint(saved as unknown as Json),
          count: selected.length,
          groups: [...groups.values()].sort((a, b) => compareQueryValues(a.value, b.value)),
        };
      }),
  };
  return api;
};
