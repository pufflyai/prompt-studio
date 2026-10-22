import {
  canonicalJson,
  fingerprint,
  type Json,
  type StorageIndexField,
  type StoragePredicate,
  type StorageRecordIndex,
  type StorageRecordQuery,
} from "pstdio-sync-contracts";

export const fieldValue = (value: Json, path: string[]) => {
  let current: Json | undefined = value;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = current[key];
  }
  return current;
};

export const typedFieldValue = (value: Json, field: StorageIndexField) => {
  const current = fieldValue(value, field.path);
  if (current == null) return current;
  if (field.type === "array")
    return Array.isArray(current) && current.every((item) => typeof item === "string") ? current : undefined;
  return typeof current === field.type ? current : undefined;
};

const validateIndex = (index: StorageRecordIndex) => {
  if (!Object.keys(index.fields).length) throw new Error("An index needs fields");
  for (const [name, field] of Object.entries(index.fields)) {
    if (!name || !["string", "number", "boolean", "array"].includes(field.type)) throw new Error("Invalid index field");
    if (!field.path.length || field.path.some((part) => typeof part !== "string" || !part))
      throw new Error("Invalid field path");
  }
  for (const name of [...(index.equality ?? []), ...(index.orderBy ?? []).map((sort) => sort.field)]) {
    if (!Object.hasOwn(index.fields, name)) throw new Error(`Unknown index field: ${name}`);
    if (index.fields[name].type === "array") throw new Error("Array fields cannot order a page");
  }
  for (const sort of index.orderBy ?? [])
    if (sort.direction !== "asc" && sort.direction !== "desc") throw new Error("Invalid sort direction");
};

export const validateIndexes = (indexes: StorageRecordIndex[]) => {
  const names = new Set<string>();
  for (const index of indexes) {
    if (!index.name || names.has(index.name)) throw new Error("Index names must be unique and nonempty");
    names.add(index.name);
    validateIndex(index);
  }
};

export const queryField = (index: StorageRecordIndex, name: string) => {
  if (!Object.hasOwn(index.fields, name)) throw new Error(`Unknown index field: ${name}`);
  return index.fields[name];
};

const validateOperator = (field: StorageIndexField, predicate: Extract<StoragePredicate, { value: Json }>) => {
  if (predicate.op === "equalsIgnoreCase" && field.type !== "string")
    throw new Error("Case-insensitive equality requires a string field");
  if (predicate.op === "contains" && field.type !== "string" && field.type !== "array")
    throw new Error("Contains requires a string or array field");
  if (field.type === "array" && ["gt", "gte", "lt", "lte"].includes(predicate.op))
    throw new Error("Array fields do not support ordering predicates");
  if (!["eq", "ne", "gt", "gte", "lt", "lte", "contains", "equalsIgnoreCase", "in", "notIn"].includes(predicate.op))
    throw new Error("Unsupported query predicate");
};

const validatePredicateValues = (field: StorageIndexField, predicate: Extract<StoragePredicate, { value: Json }>) => {
  validateOperator(field, predicate);
  const values = predicate.op === "in" || predicate.op === "notIn" ? predicate.value : [predicate.value];
  for (const value of values) {
    if (value === null && predicate.op !== "contains" && predicate.op !== "equalsIgnoreCase") continue;
    const type = Array.isArray(value) ? "array" : typeof value;
    const expected = predicate.op === "contains" && field.type === "array" ? "string" : field.type;
    if (type !== expected) throw new Error(`Query value must be ${expected}`);
    if (Array.isArray(value) && value.some((item) => typeof item !== "string"))
      throw new Error("Query arrays contain strings");
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Query number must be finite");
  }
};

export const validatePredicate = (index: StorageRecordIndex, predicate?: StoragePredicate, depth = 0) => {
  if (!predicate) return;
  if (depth > 8) throw new Error("Query predicate is too deep");
  if ("not" in predicate) {
    validatePredicate(index, predicate.not, depth + 1);
    return;
  }
  if ("all" in predicate || "any" in predicate) {
    const children = "all" in predicate ? predicate.all : predicate.any;
    if (children.length > 100) throw new Error("Too many query predicates");
    for (const child of children) validatePredicate(index, child, depth + 1);
    return;
  }
  const field = queryField(index, predicate.field);
  if (["empty", "notEmpty", "exists", "missing"].includes(predicate.op)) return;
  if (!("value" in predicate)) throw new Error("Query predicate needs a value");
  validatePredicateValues(field, predicate);
};

const compareStrings = (left: string, right: string) => {
  const a = Array.from(left, (character) => character.codePointAt(0)!);
  const b = Array.from(right, (character) => character.codePointAt(0)!);
  for (let position = 0; position < Math.min(a.length, b.length); position++)
    if (a[position] !== b[position]) return a[position] - b[position];
  return a.length - b.length;
};

export const compareQueryValues = (left: Json | undefined, right: Json | undefined) => {
  if (left === right || (left == null && right == null)) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "string" && typeof right === "string") return compareStrings(left, right);
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return left.length - right.length;
    for (let position = 0; position < left.length; position++) {
      const order = compareStrings(String(left[position]), String(right[position]));
      if (order) return order;
    }
    return 0;
  }
  return left < right ? -1 : 1;
};

export const matchesPredicate = (index: StorageRecordIndex, value: Json, predicate?: StoragePredicate) => {
  if (!predicate) return true;
  if ("not" in predicate) {
    if (matchesPredicate(index, value, predicate.not)) return false;
    return true;
  }
  if ("all" in predicate) {
    for (const child of predicate.all) if (!matchesPredicate(index, value, child)) return false;
    return true;
  }
  if ("any" in predicate) {
    for (const child of predicate.any) if (matchesPredicate(index, value, child)) return true;
    return false;
  }
  return matchesFieldPredicate(index, value, predicate);
};

const matchesFieldPredicate = (
  index: StorageRecordIndex,
  value: Json,
  predicate: Extract<StoragePredicate, { field: string }>,
) => {
  const actual = typedFieldValue(value, queryField(index, predicate.field));
  const empty = actual == null || actual === "" || (Array.isArray(actual) && !actual.length);
  switch (predicate.op) {
    case "exists":
      return actual !== undefined;
    case "missing":
      return actual === undefined;
    case "empty":
      return empty;
    case "notEmpty":
      return !empty;
    case "eq":
      return canonicalJson(actual ?? null) === canonicalJson(predicate.value);
    case "ne":
      return canonicalJson(actual ?? null) !== canonicalJson(predicate.value);
    case "equalsIgnoreCase":
      return typeof actual === "string" && actual.toLowerCase() === String(predicate.value).toLowerCase();
    case "in":
      return predicate.value.some((item) => canonicalJson(actual ?? null) === canonicalJson(item));
    case "notIn":
      return !predicate.value.some((item) => canonicalJson(actual ?? null) === canonicalJson(item));
    case "contains":
      if (Array.isArray(actual)) return actual.some((item) => canonicalJson(item) === canonicalJson(predicate.value));
      return (
        typeof actual === "string" &&
        typeof predicate.value === "string" &&
        actual.toLowerCase().includes(predicate.value.toLowerCase())
      );
    default: {
      if (actual == null || predicate.value === null) return false;
      const order = compareQueryValues(actual, predicate.value);
      if (predicate.op === "gt") return order > 0;
      if (predicate.op === "gte") return order >= 0;
      if (predicate.op === "lt") return order < 0;
      return order <= 0;
    }
  }
};

export interface QueryCursor {
  identity: string;
  revision: string;
  recordId: string;
  values: Json[];
}
export const encodeQueryCursor = (cursor: QueryCursor) => btoa(unescape(encodeURIComponent(JSON.stringify(cursor))));

const queryWindow = (query: StorageRecordQuery, revision: string) => {
  const limit = query.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Query limit must be between 1 and 100");
  const offset = query.offset ?? 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || (offset > 0 && query.cursor))
    throw new Error("Query offset must be a nonnegative integer without a cursor");
  if (query.revision !== undefined && query.revision !== revision)
    throw new Error("Query revision is stale; restart the query");
  return { limit, offset };
};

export const prepareRecordQuery = async (
  owner: { workbenchId: string; extensionId: string },
  index: StorageRecordIndex,
  query: StorageRecordQuery,
  revision: string,
) => {
  validatePredicate(index, query.where);
  const fields = query.fields ?? Object.keys(index.fields);
  for (const name of fields) queryField(index, name);
  const { limit, offset } = queryWindow(query, revision);
  const identity = await fingerprint({
    owner,
    index: index as unknown as Json,
    where: (query.where as unknown as Json) ?? null,
    fields,
  });
  let after: QueryCursor | undefined;
  if (query.cursor) {
    try {
      after = JSON.parse(decodeURIComponent(escape(atob(query.cursor)))) as QueryCursor;
    } catch {
      throw new Error("Invalid query cursor");
    }
    if (after.identity !== identity || after.revision !== revision)
      throw new Error("Query cursor is stale; restart the query");
    if (
      typeof after.recordId !== "string" ||
      !Array.isArray(after.values) ||
      after.values.length !== (index.orderBy?.length ?? 0)
    )
      throw new Error("Invalid query cursor");
  }
  return { fields, limit, offset, identity, after };
};
