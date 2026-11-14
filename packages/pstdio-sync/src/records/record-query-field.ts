import type { Json, StorageIndexField, StorageRecordIndex } from "pstdio-sync-contracts";
import { deriveMarkdownTitle } from "./markdown-title";

export const fieldValue = (value: Json, path: string[]) => {
  let current: Json | undefined = value;
  for (const key of path) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = current[key];
  }
  return current;
};

export const typedFieldValue = (value: Json, field: StorageIndexField) => {
  let current = fieldValue(value, field.path);
  if (field.derive) {
    if (typeof current === "string" && current.length) current = deriveMarkdownTitle(current, field.derive.empty);
    else current = field.derive.fallbackPath ? fieldValue(value, field.derive.fallbackPath) : undefined;
  }
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

const validateDerivedField = (field: StorageIndexField) => {
  if (!field.derive) return;
  if (field.type !== "string" || field.derive.kind !== "markdownTitle") throw new Error("Invalid derived string field");
  if (field.derive.empty !== undefined && typeof field.derive.empty !== "string")
    throw new Error("Derived empty text must be a string");
  const fallback = field.derive.fallbackPath;
  if (
    fallback !== undefined &&
    (!Array.isArray(fallback) || !fallback.length || fallback.some((part) => typeof part !== "string" || !part))
  )
    throw new Error("Invalid derived fallback path");
};

export const validateQueryField = (name: string, field: StorageIndexField) => {
  if (!name || !["string", "number", "boolean", "array", "object"].includes(field.type))
    throw new Error("Invalid index field");
  if (!Array.isArray(field.path) || !field.path.length || field.path.some((part) => typeof part !== "string" || !part))
    throw new Error("Invalid field path");
  validateDerivedField(field);
};
