import {
  canonicalJson,
  type Json,
  type StoragePredicate,
  type StorageRecord,
  type StorageRecordIndex,
} from "pstdio-sync-contracts";
import { type QueryIdentities, recordQueryIdentity } from "./memory-query-identities";
import { compareQueryValues } from "./record-query";
import { queryField, typedFieldValue } from "./record-query-field";

export const recordQueryValue = (
  index: StorageRecordIndex,
  record: StorageRecord,
  name: string,
  identities?: QueryIdentities,
  records: StorageRecord[] = [],
  resolve?: (name: string) => StorageRecordIndex,
  matches?: (index: StorageRecordIndex, record: StorageRecord, predicate: StoragePredicate) => boolean,
): Json | undefined => {
  const descriptor = queryField(index, name);
  if (descriptor.cases) {
    if (!matches) throw new Error("Conditional field needs a predicate evaluator");
    const selected = descriptor.cases.find((entry) => matches(index, record, entry.when));
    return typedFieldValue(
      { value: selected ? selected.value : (descriptor.otherwise ?? null) },
      { path: ["value"], type: descriptor.type },
    );
  }
  if (descriptor.lookup) return lookupValue(index, record, name, identities, records, resolve, matches);
  if (index.identity?.shorthandField === name) return recordQueryIdentity(index, record, identities)?.shorthand;
  if (index.identity?.aliasesField === name) return recordQueryIdentity(index, record, identities)?.aliases ?? [];
  if (index.hierarchy?.breadcrumbField === name)
    return breadcrumbValue(index, record, name, identities, records, resolve, matches);
  return typedFieldValue(record.value, queryField(index, name), record.recordId, (field) =>
    recordQueryValue(index, record, field, identities, records, resolve, matches),
  );
};

const lookupValue = (
  ...[index, record, name, identities, records = [], resolve, matches]: Parameters<typeof recordQueryValue>
): Json | undefined => {
  const descriptor = queryField(index, name);
  if (!descriptor.lookup) return undefined;
  if (!resolve) throw new Error("Related field needs installed indexes");
  const lookup = descriptor.lookup;
  const target = resolve(lookup.index);
  const selected = records
    .filter(
      (candidate) =>
        !candidate.deleted &&
        (target.prefix === undefined || candidate.recordId.startsWith(target.prefix)) &&
        (!target.identity || Boolean(recordQueryIdentity(target, candidate, identities))) &&
        lookup.on.every((join) => {
          const left = recordQueryValue(index, record, join.sourceField, identities, records, resolve, matches);
          const right = recordQueryValue(target, candidate, join.relatedField, identities, records, resolve, matches);
          if (left == null || right == null) return false;
          if (join.op === "contains") return Array.isArray(left) && left.includes(right);
          if (join.op === "containedBy") return Array.isArray(right) && right.includes(left);
          return canonicalJson(left) === canonicalJson(right);
        }),
    )
    .sort((a, b) => compareQueryValues(a.recordId, b.recordId))[0];
  return selected ? recordQueryValue(target, selected, lookup.field, identities, records, resolve, matches) : undefined;
};

const breadcrumbValue = (
  ...[index, record, , identities, records = [], resolve, matches]: Parameters<typeof recordQueryValue>
): Json | undefined => {
  if (!index.hierarchy) return undefined;

  const labels: string[] = [];
  const visited = new Set<string>();
  let current: StorageRecord | undefined = record;
  while (current && !visited.has(current.recordId)) {
    visited.add(current.recordId);
    const label = recordQueryValue(index, current, index.hierarchy.labelField, identities, records, resolve, matches);
    if (typeof label === "string") labels.push(label);
    const parent = recordQueryValue(index, current, index.hierarchy.parentField, identities, records, resolve, matches);
    if (parent == null) break;
    current = records
      .filter(
        (candidate) =>
          !candidate.deleted &&
          (index.prefix === undefined || candidate.recordId.startsWith(index.prefix)) &&
          (!index.identity || Boolean(recordQueryIdentity(index, candidate, identities))) &&
          recordQueryValue(index, candidate, index.hierarchy!.idField, identities, records, resolve, matches) ===
            parent,
      )
      .sort((a, b) => compareQueryValues(a.recordId, b.recordId))[0];
  }
  return labels.length ? labels.reverse().join(index.hierarchy.separator) : undefined;
};
