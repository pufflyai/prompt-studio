import type {
  Json,
  StorageAggregateQuery,
  StoragePredicate,
  StorageRecordIndex,
  StorageRecordQuery,
} from "pstdio-sync-contracts";
import {
  storageExpressionInfo,
  validateStorageExpression,
  validateStorageExpressionResult,
  validateViewDateFormat,
} from "pstdio-sync-contracts";
import { compareQueryValues } from "./record-query";
import { queryField, validateQueryField } from "./record-query-field";
import { withRecordQueryTextOrder } from "./record-query-text-order";
import { statisticOptions } from "./record-statistics";

const computedNodeCount = (field: NonNullable<StorageRecordQuery["computed"]>[string]) => {
  let nodes = 0;
  if (field.expression) nodes += validateStorageExpression(field.expression, () => {});
  const pending = (field.cases ?? []).map(({ when }) => ({ value: when, depth: 0 }));
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++nodes > 1024 || depth > 8) throw new Error("Computed query expressions are too large or deep");
    if ("test" in value) nodes += storageExpressionInfo(value.test).nodes;
    for (const child of predicateChildren(value)) pending.push({ value: child, depth: depth + 1 });
  }
  return nodes;
};

export const validateRelatedQueryFields = (
  query: Pick<StorageRecordQuery, "index" | "computed" | "formats" | "related">,
) => {
  const related = Object.entries(query.related ?? {});
  if (related.length > 16 || related.some(([name]) => !name || name === query.index))
    throw new Error("Related fields need up to 16 different related indexes");
  const fields = [query, ...related.map(([, fields]) => fields)].reduce(
    (sum, fields) => sum + Object.keys(fields.computed ?? {}).length + Object.keys(fields.formats ?? {}).length,
    0,
  );
  if (fields > 32) throw new Error("A query supports at most 32 computed and formatted fields across related indexes");
  let nodes = 0;
  for (const binding of [query, ...related.map(([, fields]) => fields)]) {
    for (const field of Object.values(binding.computed ?? {})) {
      nodes += computedNodeCount(field);
      if (nodes > 1024) throw new Error("Computed query expressions are too large");
    }
  }
};

const computedFields = (
  declared: StorageRecordIndex,
  computed: [string, NonNullable<StorageRecordQuery["computed"]>[string]][],
) => {
  const fields = { ...declared.fields };
  let nodes = 0;
  for (const [name, field] of computed) {
    if (Object.hasOwn(fields, name)) throw new Error(`Computed field already declared: ${name}`);
    if (Boolean(field.expression) === Boolean(field.cases))
      throw new Error("Computed field needs an expression or cases");
    if (field.cases && (!Array.isArray(field.cases) || !field.cases.length || field.cases.length > 16))
      throw new Error("Computed field needs 1 to 16 cases");
    if (field.expression)
      nodes += validateStorageExpression(field.expression, (fieldName, up) => {
        if (up) throw new Error("Computed fields must be record local");
        queryField(declared, fieldName);
      });
    if (nodes > 1024) throw new Error("Computed query expressions are too large");
    if (field.expression) validateStorageExpressionResult(field.expression, field.type);
    Object.defineProperty(fields, name, { value: { path: ["value"], ...field }, enumerable: true });
    validateQueryField(name, fields[name]);
  }
  return fields;
};

const formattedFields = (
  declared: StorageRecordIndex,
  index: StorageRecordIndex,
  formats: [string, NonNullable<StorageRecordQuery["formats"]>[string]][],
) => {
  const fields = { ...index.fields };
  for (const [name, format] of formats) {
    if (Object.hasOwn(fields, name)) throw new Error(`Formatted field already declared: ${name}`);
    validateViewDateFormat(format);
    const source = queryField(declared, format.field);
    if (
      !["string", "number"].includes(source.type) ||
      source.lookup ||
      source.expression ||
      source.cases ||
      format.field === declared.identity?.shorthandField ||
      format.field === declared.hierarchy?.breadcrumbField
    )
      throw new Error("Date formatting needs a declared local string or number field");
    Object.defineProperty(fields, name, {
      enumerable: true,
      value: { path: ["value"], type: format.part === "text" ? "string" : "number", format },
    });
  }
  return fields;
};

export const requestedRecordIndex = (
  declared: StorageRecordIndex,
  query: Pick<StorageRecordQuery, "computed" | "formats" | "orderBy" | "textOrder">,
) => {
  let index = declared;
  const computed = Object.entries(query.computed ?? {});
  if (computed.length > 32) throw new Error("A query supports at most 32 computed fields");
  if (computed.length) {
    index = { ...index, fields: computedFields(declared, computed) };
  }
  const formats = Object.entries(query.formats ?? {});
  if (computed.length + formats.length > 32)
    throw new Error("A query supports at most 32 computed and formatted fields");
  if (formats.length) {
    index = { ...index, fields: formattedFields(declared, index, formats) };
  }
  if (query.orderBy === undefined) return withRecordQueryTextOrder(index, query.textOrder);
  if (!Array.isArray(query.orderBy) || query.orderBy.length > 8) throw new Error("Query order needs at most 8 fields");
  const seen = new Set<string>();
  for (const sort of query.orderBy) {
    const field = queryField(index, sort.field);
    if (["array", "object"].includes(field.type)) throw new Error("Array and object fields cannot order a page");
    if (!["asc", "desc"].includes(sort.direction) || seen.has(sort.field)) throw new Error("Invalid query order");
    seen.add(sort.field);
  }
  return withRecordQueryTextOrder({ ...index, orderBy: query.orderBy }, query.textOrder);
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

const validateAggregateFingerprint = (index: StorageRecordIndex, fingerprint: StorageAggregateQuery["fingerprint"]) => {
  if (fingerprint !== undefined) {
    if (
      !Array.isArray(fingerprint) ||
      !fingerprint.length ||
      fingerprint.length > 32 ||
      new Set(fingerprint).size !== fingerprint.length
    )
      throw new Error("Aggregate fingerprints need 1 to 32 different fields");
    for (const field of fingerprint) queryField(index, field);
  }
};

export const aggregateOptions = (index: StorageRecordIndex, query: StorageAggregateQuery) => {
  const statistics = statisticOptions(index, query);
  validateAggregateFingerprint(index, query.fingerprint);
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
  return { groupBy, metrics, groupLimit, statistics };
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
