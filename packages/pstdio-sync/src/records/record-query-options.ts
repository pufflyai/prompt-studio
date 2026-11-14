import type {
  Json,
  StorageAggregateQuery,
  StoragePredicate,
  StorageRecordIndex,
  StorageRecordQuery,
} from "pstdio-sync-contracts";
import { compareQueryValues } from "./record-query";
import { queryField } from "./record-query-field";

export const requestedRecordIndex = (index: StorageRecordIndex, query: StorageRecordQuery) => {
  if (query.orderBy === undefined) return index;
  if (!Array.isArray(query.orderBy) || query.orderBy.length > 8) throw new Error("Query order needs at most 8 fields");
  const seen = new Set<string>();
  for (const sort of query.orderBy) {
    const field = queryField(index, sort.field);
    if (["array", "object"].includes(field.type)) throw new Error("Array and object fields cannot order a page");
    if (!["asc", "desc"].includes(sort.direction) || seen.has(sort.field)) throw new Error("Invalid query order");
    seen.add(sort.field);
  }
  return { ...index, orderBy: query.orderBy };
};

/** Discover only the indexes named by a bounded predicate, never an owner's resource collection. */
export const relatedQueryIndexes = (predicate?: StoragePredicate) => {
  const names = new Set<string>();
  let nodes = 0;
  const pending = predicate ? [{ value: predicate, depth: 0 }] : [];
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++nodes > 256 || depth > 8) throw new Error("Query predicate is too large or deep");
    if ("exists" in value) {
      if (!value.exists || typeof value.exists.index !== "string" || !value.exists.index)
        throw new Error("Related query needs an index");
      names.add(value.exists.index);
      if (names.size > 16) throw new Error("Query needs at most 16 related indexes");
    }
    for (const child of predicateChildren(value)) pending.push({ value: child, depth: depth + 1 });
  }
  return [...names];
};

const predicateChildren = (value: StoragePredicate) => {
  if ("exists" in value) return value.exists.where ? [value.exists.where] : [];
  if ("not" in value) return [value.not];
  if ("all" in value) return value.all;
  if ("any" in value) return value.any;
  return [];
};

export const aggregateOptions = (index: StorageRecordIndex, query: StorageAggregateQuery) => {
  let groupBy: string[] = [];
  if (typeof query.groupBy === "string") groupBy = [query.groupBy];
  else if (query.groupBy !== undefined) groupBy = query.groupBy;
  if (
    !Array.isArray(groupBy) ||
    (!groupBy.length && query.groupBy !== undefined) ||
    groupBy.length > 8 ||
    new Set(groupBy).size !== groupBy.length
  )
    throw new Error("Aggregate grouping needs 1 to 8 different fields");
  for (const field of groupBy) queryField(index, field);
  const metrics = Object.entries(query.metrics ?? {});
  if (metrics.length > 16) throw new Error("Aggregate needs at most 16 metrics");
  for (const [name, metric] of metrics) {
    if (!name || !["sum", "min", "max"].includes(metric.operation)) throw new Error("Invalid aggregate metric");
    if (queryField(index, metric.field).type !== "number") throw new Error("Aggregate metrics require a number field");
  }
  const groupLimit =
    query.groupLimit ?? (query.metrics !== undefined || Array.isArray(query.groupBy) ? 500 : undefined);
  if (groupLimit !== undefined && (!Number.isSafeInteger(groupLimit) || groupLimit < 1 || groupLimit > 500))
    throw new Error("Aggregate group limit must be between 1 and 500");
  return { groupBy, metrics, groupLimit };
};

export const compareAggregateGroups = (query: StorageAggregateQuery, left: Json, right: Json) => {
  if (!Array.isArray(query.groupBy) || !Array.isArray(left) || !Array.isArray(right))
    return compareQueryValues(left, right);
  for (let i = 0; i < query.groupBy.length; i++) {
    const compared = compareQueryValues(left[i], right[i]);
    if (compared) return compared;
  }
  return 0;
};
