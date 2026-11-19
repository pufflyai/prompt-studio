import {
  canonicalJson,
  fingerprint,
  type Json,
  type StorageRecord,
  type StorageRecordIndex,
  type StorageRecordQueries,
} from "pstdio-sync-contracts";
import type * as Y from "yjs";
import type { DocumentStore, StorageOwner } from "../shared";
import { readDocumentRecord } from "./document-record";
import { memoryQueryIdentities, type QueryIdentities, recordQueryIdentity } from "./memory-query-identities";
import { memoryRecordAggregate } from "./memory-record-aggregate";
import { orderDependencyRecords } from "./record-dependency-order";
import {
  compareQueryValues,
  encodeQueryCursor,
  matchesPredicate,
  prepareRecordQuery,
  validateComputedConditions,
  validateIndexes,
  validatePredicate,
} from "./record-query";
import { loadQueryIndexDependencies } from "./record-query-dependencies";
import { relatedQueryIndexes, requestedRecordIndex, validateRelatedQueryFields } from "./record-query-options";
import { compareRecordQueryText } from "./record-query-text-order";
import { recordQueryValue } from "./record-query-value";

const memoryPredicate = (
  saved: StorageRecord[],
  identities: QueryIdentities,
  resolve: (name: string) => StorageRecordIndex,
) => {
  type Scope = { index: StorageRecordIndex; record: StorageRecord };
  const read = (index: StorageRecordIndex, record: StorageRecord, name: string) => {
    const result: Json | undefined = recordQueryValue(
      index,
      record,
      name,
      identities,
      saved,
      resolve,
      (index, record, where) => matches({ index, record }, where),
    );
    return result;
  };
  const matches = (
    source: Scope,
    where?: import("pstdio-sync-contracts").StoragePredicate,
    ancestors: Scope[] = [],
    variables: Record<string, Json | undefined> = {},
  ): boolean => {
    const fields = (name: string, up = 0) => {
      const scope = [source, ...ancestors][up];
      return scope ? read(scope.index, scope.record, name) : undefined;
    };
    return matchesPredicate(
      source.index,
      source.record.value,
      where,
      (_index, _value, selection) => {
        const index = resolve(selection.index);
        const related = (names: typeof variables) =>
          saved.filter(
            (record) =>
              !record.deleted &&
              (!index.identity || Boolean(recordQueryIdentity(index, record, identities))) &&
              (index.prefix === undefined || record.recordId.startsWith(index.prefix)) &&
              selection.on.every((join) => {
                const left = fields(join.sourceField);
                const right = read(index, record, join.relatedField);
                return matchesJoin(left, right, join.op);
              }) &&
              matches({ index, record }, selection.where, [source, ...ancestors], names),
          );
        if (!selection.every) return related(variables).length > 0;
        const every = selection.every;
        const values = fields(every.field);
        return (
          Array.isArray(values) &&
          values.every((value) => {
            const count = related({ ...variables, [every.as]: value }).length;
            return every.matches === "one" ? count === 1 : count > 0;
          })
        );
      },
      fields,
      variables,
    );
  };
  return { resolve, matches, read };
};

const definitions = new WeakMap<Y.Doc, Map<string, StorageRecordIndex>>();
const indexFor = (document: Y.Doc, name: string) => {
  const index = definitions.get(document)?.get(name);
  if (!index) throw new Error(`Storage index not installed: ${name}`);
  return index;
};
const revisionContext = (document: Y.Doc, identities: QueryIdentities) => ({
  identities: [...identities.entries()] as unknown as Json,
  indexes: [...(definitions.get(document)?.values() ?? [])].sort((left, right) =>
    compareQueryValues(left.name, right.name),
  ) as unknown as Json,
});
const queryRevision = (document: Y.Doc, saved: StorageRecord[], identities: QueryIdentities) =>
  fingerprint({ saved: saved as unknown as Json, ...revisionContext(document, identities) });

interface OrderedRecord {
  recordId: string;
  values: Json[];
}
const compareRecords = (index: StorageRecordIndex, left: OrderedRecord, right: OrderedRecord) => {
  for (const [position, sort] of (index.orderBy ?? []).entries()) {
    const a = left.values[position];
    const b = right.values[position];
    const order = compareRecordQueryText(index, sort.field, a, b) ?? compareQueryValues(a, b);
    if (!order) continue;
    if (a == null || b == null || sort.direction === "asc") return order;
    return -order;
  }
  if (left.recordId === right.recordId) return 0;
  return compareQueryValues(left.recordId, right.recordId);
};

export const createMemoryRecordQueries = (
  owner: StorageOwner,
  store: DocumentStore,
  source?: {
    list(): Promise<StorageRecord[]>;
    read(id: string): Promise<StorageRecord>;
    /** Replace whenever list() changes; the token and snapshot are read under the same owner transaction. */
    revisionToken?(): object;
    identity?(kind: string, id: string): Promise<{ shorthand: string } | null>;
  },
) => {
  const records = (document: Y.Doc) =>
    source?.list() ?? Promise.all([...document.getMap("records").keys()].map((id) => readDocumentRecord(document, id)));
  let cachedRevision: { token: object; context: string; value: Promise<string> } | undefined;
  const revisionFor = async (
    document: Y.Doc,
    saved: StorageRecord[],
    identities: QueryIdentities,
    token: object | undefined,
  ) => {
    if (!token) return queryRevision(document, saved, identities);
    const context = await fingerprint(revisionContext(document, identities));
    if (source?.revisionToken?.() !== token) return queryRevision(document, saved, identities);
    if (cachedRevision?.token !== token || cachedRevision.context !== context)
      cachedRevision = { token, context, value: queryRevision(document, saved, identities) };
    return cachedRevision.value;
  };
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
        return Promise.all(ids.map((id) => (source ? source.read(id) : readDocumentRecord(document, id))));
      }),
    query: (query) =>
      store.transaction(owner, async ({ document }) => {
        validateRelatedQueryFields(query);
        const index = requestedRecordIndex(indexFor(document, query.index), query);
        for (const name of relatedQueryIndexes(query.where)) indexFor(document, name);
        const token = source?.revisionToken?.();
        const saved = await records(document);
        const dependencies = await loadQueryIndexDependencies(index, query.where, async (name) =>
          requestedRecordIndex(indexFor(document, name), query.related?.[name] ?? {}),
        );
        const identities = await memoryQueryIdentities(dependencies.definitions, saved, source?.identity);
        const predicate = memoryPredicate(saved, identities, dependencies.resolve);
        const revision = await revisionFor(document, saved, identities, token);
        const page = await prepareRecordQuery(owner, index, query, revision, predicate.resolve);
        if (page.limit === 0) return { revision, records: [], cursor: null };
        const values = (record: StorageRecord) =>
          (index.orderBy ?? []).map((sort) => predicate.read(index, record, sort.field) ?? null);
        const compare = (left: OrderedRecord, right: OrderedRecord) => compareRecords(index, left, right);
        const selected = saved
          .filter(
            (record) =>
              !record.deleted &&
              (!index.identity || Boolean(recordQueryIdentity(index, record, identities))) &&
              (index.prefix === undefined || record.recordId.startsWith(index.prefix)) &&
              predicate.matches({ index, record }, query.where),
          )
          .map((record) => ({ record, recordId: record.recordId, values: values(record) }))
          .filter((record) => !page.after || compare(record, page.after) > 0)
          .sort(compare);
        const graph = query.dependencyOrder;
        const visible = graph
          ? orderDependencyRecords(
              selected,
              ({ record }) => predicate.read(index, record, graph.idField),
              ({ record }) => predicate.read(index, record, graph.dependenciesField),
              page.limit,
            )
          : selected.slice(page.offset, page.offset + page.limit);
        const last = visible.at(-1);
        return {
          revision,
          records: visible.map(({ record }) => ({
            recordId: record.recordId,
            revision: record.revision,
            fields: Object.fromEntries(page.fields.map((name) => [name, predicate.read(index, record, name) ?? null])),
          })),
          cursor:
            !graph && last && selected.length > page.offset + page.limit
              ? encodeQueryCursor({ identity: page.identity, revision, recordId: last.recordId, values: last.values })
              : null,
        };
      }),
    aggregate: (query) =>
      store.transaction(owner, async ({ document }) => {
        validateRelatedQueryFields(query);
        const index = requestedRecordIndex(indexFor(document, query.index), query);
        for (const name of relatedQueryIndexes(query.where)) indexFor(document, name);
        const token = source?.revisionToken?.();
        const saved = await records(document);
        const dependencies = await loadQueryIndexDependencies(index, query.where, async (name) =>
          requestedRecordIndex(indexFor(document, name), query.related?.[name] ?? {}),
        );
        const identities = await memoryQueryIdentities(dependencies.definitions, saved, source?.identity);
        const predicate = memoryPredicate(saved, identities, dependencies.resolve);
        validatePredicate(index, query.where, 0, predicate.resolve);
        validateComputedConditions(index, predicate.resolve);
        const selected = saved.filter(
          (record) =>
            !record.deleted &&
            (!index.identity || Boolean(recordQueryIdentity(index, record, identities))) &&
            (index.prefix === undefined || record.recordId.startsWith(index.prefix)) &&
            predicate.matches({ index, record }, query.where),
        );
        return memoryRecordAggregate(
          index,
          query,
          selected,
          await revisionFor(document, saved, identities, token),
          identities,
          saved,
          predicate.resolve,
          predicate.read,
        );
      }),
  };
  return api;
};

const matchesJoin = (left: Json | undefined, right: Json | undefined, operation?: string) => {
  if (left == null || right == null) return false;
  if (operation === "contains") return Array.isArray(left) && left.includes(right);
  if (operation === "containedBy") return Array.isArray(right) && right.includes(left);
  return canonicalJson(left) === canonicalJson(right);
};
