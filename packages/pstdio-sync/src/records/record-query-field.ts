import {
  evaluateStorageExpression,
  formatViewDate,
  type Json,
  type StorageIndexField,
  type StorageRecordIndex,
} from "pstdio-sync-contracts";
import { derivedQueryValue, validateDerivedField } from "./record-query-derive";

export const fieldValue = (value: Json, path: string[]) => {
  let current: Json | undefined = value;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = current[key];
  }
  return current;
};

const querySourceValue = (
  value: Json,
  field: StorageIndexField,
  recordId?: string,
  resolve?: (name: string) => Json | undefined,
) => {
  if (field.expression) return evaluateStorageExpression(field.expression, resolve);
  if (field.format) return formatViewDate(resolve?.(field.format.field), field.format);
  if (field.derive) return derivedQueryValue(value, field, recordId);
  return fieldValue(value, field.path ?? []);
};

export const typedFieldValue = (
  value: Json,
  field: StorageIndexField,
  recordId?: string,
  resolve?: (name: string) => Json | undefined,
): Json | undefined => {
  const current: Json | undefined = querySourceValue(value, field, recordId, resolve);
  if (current == null) return current;
  if (field.type === "array")
    return Array.isArray(current) && current.every((item) => typeof item === "string") ? current : undefined;
  if (field.type === "object") return typeof current === "object" && !Array.isArray(current) ? current : undefined;
  return typeof current === field.type ? current : undefined;
};

export const queryField = (index: StorageRecordIndex, name: string) => {
  if (!Object.hasOwn(index.fields, name)) throw new Error(`Unknown index field: ${name}`);
  return index.fields[name];
};

export const validateQueryField = (name: string, field: StorageIndexField) => {
  if (!name || !["string", "number", "boolean", "array", "object"].includes(field.type))
    throw new Error("Invalid index field");
  if (field.lookup) {
    if (!field.lookup.index || !field.lookup.field || field.derive || field.expression || field.path !== undefined)
      throw new Error("Related projection needs an index and field without a local path");
    return;
  }
  if (!Array.isArray(field.path) || !field.path.length || field.path.some((part) => typeof part !== "string" || !part))
    throw new Error("Invalid field path");
  validateDerivedField(field);
};
