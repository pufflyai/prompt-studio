import { fingerprint, type Json, jsonSchema } from "pstdio-sync-contracts";
import { type ObservedJson, parseJsonPointer, validateJsonChanges } from "./ordered-json";
import type {
  OrderedAdmission,
  OrderedLifetime,
  OrderedObservation,
  OrderedOperation,
  OrderedRecord,
} from "./ordered-operation";
import { validateOrderedTextChanges, validateOrderedTexts } from "./ordered-text";

const shape = (value: unknown, fields?: string[]) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid ordered object");
  const result = value as Record<string, unknown>;
  if (fields && Object.keys(result).some((key) => !fields.includes(key))) throw new Error("Unknown ordered field");
  return result;
};
const text = (value: unknown) => {
  if (typeof value !== "string" || !value) throw new Error("Invalid ordered identity");
  return value;
};
const digest = (value: unknown) => {
  if (!/^[a-f0-9]{64}$/.test(text(value))) throw new Error("Invalid ordered fingerprint");
};
const stamp = (value: unknown) => {
  const parts: unknown = JSON.parse(text(value));
  if (!Array.isArray(parts) || parts.length !== 3) throw new Error("Invalid ordered stamp");
  text(parts[1]);
  if (parts[0] === "pending") digest(parts[2]);
  else if (parts[0] === "canonical") text(parts[2]);
  else if (parts[0] === "text") {
    digest(parts[1]);
    digest(parts[2]);
  } else throw new Error("Unknown ordered stamp");
};
const observedValue = (input: unknown) => {
  const pending = [input];
  while (pending.length) {
    const node = shape(pending.pop(), ["kind", "fields", "digest"]);
    if (node.kind === "value") {
      if (Object.hasOwn(node, "fields")) throw new Error("Invalid observed leaf");
      digest(node.digest);
    } else if (node.kind === "object") {
      if (Object.hasOwn(node, "digest")) throw new Error("Invalid observed object");
      pending.push(...Object.values(shape(node.fields)));
    } else throw new Error("Invalid observed value");
  }
  return input as ObservedJson;
};
const lifetimeObservation = (input: unknown, fields = ["version", "exists", "deleted", "lifetime"]) => {
  const value = shape(input, fields);
  if (value.version !== 1 || typeof value.exists !== "boolean" || typeof value.deleted !== "boolean")
    throw new Error("Invalid ordered observation");
  if (value.exists !== (value.lifetime !== null) || (!value.exists && value.deleted))
    throw new Error("Invalid observed lifetime");
  if (value.lifetime !== null && value.lifetime !== "initial") stamp(value.lifetime);
  return input as OrderedLifetime;
};
const observation = (input: unknown) => {
  lifetimeObservation(input, ["version", "exists", "deleted", "lifetime", "value", "stamps"]);
  const value = shape(input);
  observedValue(value.value);
  for (const [pointer, write] of Object.entries(shape(value.stamps))) {
    parseJsonPointer(pointer);
    stamp(write);
  }
  return input as OrderedObservation;
};

export const readOrderedObservation = (revision: string) => observation(jsonSchema.parse(JSON.parse(revision)));

const base = (input: unknown) => {
  lifetimeObservation(input, ["version", "exists", "deleted", "lifetime", "stamps"]);
  for (const [pointer, write] of Object.entries(shape(shape(input).stamps))) {
    parseJsonPointer(pointer);
    stamp(write);
  }
};

const changes = (input: unknown) => {
  if (!Array.isArray(input)) throw new Error("Invalid ordered changes");
  for (const entry of input) {
    const change = shape(entry, ["path", "set", "remove"]);
    if (!Array.isArray(change.path) || change.path.some((part) => typeof part !== "string"))
      throw new Error("Invalid JSON path");
    if (
      Object.hasOwn(change, "set") === Object.hasOwn(change, "remove") ||
      (Object.hasOwn(change, "remove") && change.remove !== true)
    )
      throw new Error("Invalid JSON change");
  }
  validateJsonChanges(input as OrderedOperation["edits"][number]["changes"]);
};

/** Validate before any ordered state changes; return an owned snapshot rather than a caller-mutable envelope. */
export const verifyOrderedOperation = async (input: unknown) => {
  const value = JSON.parse(JSON.stringify(jsonSchema.parse(input))) as Record<string, unknown>;
  shape(value, ["version", "operationId", "fingerprint", "supersedes", "edits"]);
  if (value.version !== 1 || !Array.isArray(value.edits) || !value.edits.length)
    throw new Error("Invalid ordered save");
  text(value.operationId);
  if (value.supersedes !== undefined) {
    if (!Array.isArray(value.supersedes) || !value.supersedes.length) throw new Error("Invalid superseded saves");
    for (const id of value.supersedes) text(id);
    if (new Set(value.supersedes).size !== value.supersedes.length) throw new Error("Duplicate superseded save");
  }
  digest(value.fingerprint);
  const ids = new Set<string>();
  for (const input of value.edits) {
    const edit = shape(input, ["recordId", "changes", "texts", "deleted", "condition", "base"]);
    const id = text(edit.recordId);
    if (ids.has(id)) throw new Error("A save must name each record once");
    ids.add(id);
    changes(edit.changes);
    if (edit.texts !== undefined) validateOrderedTextChanges(edit.texts);
    if (edit.deleted !== undefined && typeof edit.deleted !== "boolean") throw new Error("Invalid deletion");
    if (edit.condition !== undefined) {
      const condition = shape(edit.condition);
      if (Object.hasOwn(condition, "value") || Object.hasOwn(condition, "stamps")) observation(condition);
      else lifetimeObservation(condition);
    }
    if (edit.base !== undefined) base(edit.base);
  }
  const { fingerprint: identity, ...body } = value;
  if ((await fingerprint(body as Json)) !== identity)
    throw new Error("Ordered operation identity does not match its payload");
  return value as unknown as OrderedOperation;
};

export const verifyOrderedRecord = async (input: unknown) => {
  const value = shape(jsonSchema.parse(input), ["recordId", "value", "deleted", "lifetime", "stamps", "texts"]);
  text(value.recordId);
  if (!Object.hasOwn(value, "value") || typeof value.deleted !== "boolean") throw new Error("Invalid ordered record");
  if (value.lifetime !== "initial") stamp(value.lifetime);
  for (const [pointer, write] of Object.entries(shape(value.stamps))) {
    parseJsonPointer(pointer);
    stamp(write);
  }
  if (value.texts !== undefined) await validateOrderedTexts(value.texts, value.value as Json);
  return input as OrderedRecord;
};

/** Capture the entire delivery wrapper before yielding, including its dependency identities. */
export const verifyOrderedAdmission = async (input: unknown) => {
  const value = shape(JSON.parse(JSON.stringify(jsonSchema.parse(input))), ["epoch", "operation", "dependencies"]);
  text(value.epoch);
  if (!Array.isArray(value.dependencies)) throw new Error("Invalid ordered dependencies");
  const ids = new Set<string>();
  for (const input of value.dependencies) {
    const dependency = shape(input, ["operationId", "epoch", "fingerprint"]);
    const id = text(dependency.operationId);
    text(dependency.epoch);
    digest(dependency.fingerprint);
    if (ids.has(id)) throw new Error("Duplicate ordered dependency");
    ids.add(id);
  }
  value.operation = await verifyOrderedOperation(value.operation);
  return value as unknown as OrderedAdmission;
};
