import {
  deriveMarkdownTitle,
  evaluateStorageExpression,
  formatViewDate,
  type Json,
  resolveSelectedValues,
  type StorageIndexField,
  validateStorageExpression,
  validateStorageExpressionResult,
  validateViewDateFormat,
} from "pstdio-sync-contracts";
import { fieldValue, typedFieldValue, validateQueryField } from "./record-query-field";

const tokenValue = (current: Json | undefined, field: StorageIndexField) => {
  if (field.derive?.kind !== "tokens") return undefined;
  if (typeof current !== "string") return undefined;
  const definition = field.derive;
  const match = new RegExp(definition.pattern).exec(definition.trim ? current.trim() : current);
  if (match?.[1] === undefined) return undefined;
  const tokens = match[1].split(new RegExp(definition.split));
  return tokens.length && tokens.every((value) => new RegExp(definition.itemPattern).test(value)) ? tokens : undefined;
};
const stringListValue = (current: Json | undefined, field: StorageIndexField) => {
  if (field.derive?.kind !== "stringList") return undefined;
  const values = typeof current === "string" ? [current] : current;
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) return [];
  const definition = field.derive;
  return values
    .map((value) => (definition.trim ? String(value).trim() : String(value)))
    .filter((value) => value.length && !definition.exclude?.includes(value));
};
const addressValue = (field: StorageIndexField, recordId?: string) => {
  if (field.derive?.kind !== "collectionKey" && field.derive?.kind !== "scopeId") return undefined;
  if (!recordId) return undefined;
  try {
    const address = JSON.parse(recordId);
    return Array.isArray(address) ? address[field.derive.kind === "scopeId" ? 1 : address.length - 1] : undefined;
  } catch {
    return undefined;
  }
};
const selectionsValue = (current: Json | undefined, field: StorageIndexField, value: Json) => {
  if (field.derive?.kind !== "selections") return undefined;
  const delta = fieldValue(value, field.derive.selectionPath);
  const object = (input: Json | undefined) =>
    input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const legacy = object(current);
  const changes = object(delta);
  return Object.fromEntries(
    [...new Set([...Object.keys(legacy), ...Object.keys(changes)])].map((key) => [
      key,
      resolveSelectedValues(legacy[key], changes[key]),
    ]),
  );
};
const markdownValue = (current: Json | undefined, field: StorageIndexField, value: Json) => {
  if (field.derive?.kind !== "markdownTitle") return undefined;
  if (typeof current === "string" && current.length) return deriveMarkdownTitle(current, field.derive.empty);
  return field.derive.fallbackPath ? fieldValue(value, field.derive.fallbackPath) : undefined;
};
const selectionValue = (current: Json | undefined, field: StorageIndexField, value: Json) => {
  if (field.derive?.kind !== "selection") return undefined;
  const known = field.derive.knownValues;
  const selected = resolveSelectedValues(current, fieldValue(value, field.derive.selectionPath)).filter(
    (id) => !known || known.includes(id),
  );
  return field.type === "string" ? selected[0] : selected;
};
export const derivedQueryValue = (value: Json, field: StorageIndexField, recordId?: string) => {
  if (field.derive?.kind === "date")
    return formatViewDate(typedFieldValue(value, field.derive.source, recordId), field.derive.format);
  const current = fieldValue(value, field.path ?? []);
  if (field.derive?.kind === "string") return String(current);
  if (field.derive?.kind === "timestamp") {
    const instant = typeof current === "string" ? Date.parse(current) : Number.NaN;
    return Number.isFinite(instant) ? instant : undefined;
  }
  if (field.derive?.kind === "tokens") return tokenValue(current, field);
  if (field.derive?.kind === "stringList") return stringListValue(current, field);
  if (field.derive?.kind === "collectionKey" || field.derive?.kind === "scopeId") return addressValue(field, recordId);
  if (field.derive?.kind === "expression")
    return evaluateStorageExpression(field.derive.expression, undefined, { value: current });
  if (field.derive?.kind === "selections") return selectionsValue(current, field, value);
  if (field.derive?.kind === "markdownTitle") return markdownValue(current, field, value);
  if (field.derive?.kind === "selection") return selectionValue(current, field, value);
  return current;
};

const validateTokens = (field: StorageIndexField) => {
  if (field.derive?.kind !== "tokens") return;
  if (field.type !== "array") throw new Error("Token projections need array type");
  for (const pattern of [field.derive.pattern, field.derive.split, field.derive.itemPattern]) {
    if (typeof pattern !== "string" || !pattern.length || pattern.length > 512)
      throw new Error("Invalid token projection pattern");
    new RegExp(pattern);
  }
  return;
};
const validateDate = (field: StorageIndexField) => {
  if (field.derive?.kind !== "date") return;
  validateViewDateFormat(field.derive.format);
  const source = field.derive.source;
  if (
    !["string", "number"].includes(source.type) ||
    source.format ||
    source.lookup ||
    source.expression ||
    source.cases ||
    source.derive?.kind === "date"
  )
    throw new Error("Date projections need a local string or number source");
  validateQueryField("date source", source);
  if (field.type !== (field.derive.format.part === "text" ? "string" : "number"))
    throw new Error("Invalid date projection type");
  return;
};
const validateStringList = (field: StorageIndexField) => {
  if (field.derive?.kind !== "stringList") return;
  if (
    field.type !== "array" ||
    (field.derive.trim !== undefined && typeof field.derive.trim !== "boolean") ||
    (field.derive.exclude !== undefined &&
      (!Array.isArray(field.derive.exclude) || field.derive.exclude.some((value) => typeof value !== "string")))
  )
    throw new Error("String-list projections need array type and string exclusions");
  return;
};
const validateSelections = (field: StorageIndexField) => {
  if (field.derive?.kind !== "selection" && field.derive?.kind !== "selections") return;
  if (field.derive.kind === "selections" && field.type !== "object") throw new Error("Selections need object type");
  if (field.derive.kind === "selection" && !["array", "string"].includes(field.type))
    throw new Error("Selection fields need string or array type");
  const path = field.derive.selectionPath;
  if (!Array.isArray(path) || !path.length || path.some((part) => typeof part !== "string" || !part))
    throw new Error("Invalid selection path");
  const known = field.derive.kind === "selection" ? field.derive.knownValues : undefined;
  if (
    known !== undefined &&
    (!Array.isArray(known) || known.some((value) => typeof value !== "string") || new Set(known).size !== known.length)
  )
    throw new Error("Known selection values must be different strings");
  return;
};
export const validateDerivedField = (field: StorageIndexField) => {
  if (!field.derive) return;
  if (field.derive.kind === "tokens") return validateTokens(field);
  if (field.derive.kind === "date") return validateDate(field);
  if (field.derive.kind === "timestamp") {
    if (field.type !== "number") throw new Error("Timestamp projections need number type");
    return;
  }
  if (field.derive.kind === "string") {
    if (field.type !== "string") throw new Error("String projections need string type");
    return;
  }
  if (field.derive.kind === "stringList") return validateStringList(field);
  if (field.derive.kind === "collectionKey" || field.derive.kind === "scopeId") {
    if (field.type !== "string") throw new Error("Storage address projections need string type");
    return;
  }
  if (field.derive.kind === "expression") {
    validateStorageExpression(field.derive.expression, undefined, new Set(["value"]));
    validateStorageExpressionResult(field.derive.expression, field.type);
    return;
  }
  if (field.derive.kind === "selection" || field.derive.kind === "selections") return validateSelections(field);
  validateMarkdown(field);
};

const validateMarkdown = (field: StorageIndexField) => {
  if (field.derive?.kind !== "markdownTitle") throw new Error("Invalid derived string field");
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
