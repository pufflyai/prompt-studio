import { fingerprint, type Json } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { decodeBytes, encodeBytes } from "../shared";
import { readTextDocumentSeed, saveTextDocument, seedTextDocument } from "../text";
import { textDocumentKeys } from "../text/text-document-keys";
import { applyJsonChanges, type JsonChange, jsonPointer, parseJsonPointer, pathsOverlap } from "./ordered-json";
export class OrderedTextCausalityError extends Error {}

export interface OrderedTextDependency {
  operationId: string;
  fingerprint: string;
}
export interface OrderedTextState {
  state: string;
  seed: string;
  /** Optimistic causal frontier; canonical fields never retain unresolved identities. */
  pending: OrderedTextDependency[];
}
export interface OrderedTextChange {
  path: string[];
  update: string;
  seed: string;
  dependencies: OrderedTextDependency[];
}

export const readOrderedPath = (value: Json, path: string[]) => {
  let current: Json | undefined = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !Object.hasOwn(current, key))
      return undefined;
    current = current[key];
  }
  return current;
};

/** Removing a field retires its old Y history; a later string starts from new genesis. */
export const retainOrderedTexts = (
  value: Json,
  before: Record<string, OrderedTextState>,
  changes: JsonChange[],
  textChanges: OrderedTextChange[],
) => {
  const texts = { ...before };
  const retired = new Set<string>();
  for (const pointer of Object.keys(texts)) {
    const path = parseJsonPointer(pointer);
    if (
      textChanges.some((change) => jsonPointer(change.path) === pointer) ||
      !changes.some((change) => pathsOverlap(change.path, path))
    )
      continue;
    const source = readOrderedPath(value, path);
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, decodeBytes(texts[pointer]!.state));
      if (typeof source === "string" && source === document.getText("content").toString()) continue;
      delete texts[pointer];
      retired.add(pointer);
    } finally {
      document.destroy();
    }
  }
  if (retired.size && value && typeof value === "object" && !Array.isArray(value)) {
    const bindings = value.nativeSources;
    if (bindings && typeof bindings === "object" && !Array.isArray(bindings)) {
      const sources = Object.fromEntries(
        Object.entries(bindings).filter(
          ([, source]) =>
            !(
              source &&
              typeof source === "object" &&
              !Array.isArray(source) &&
              typeof source.field === "string" &&
              retired.has(`/value${source.field}`)
            ),
        ),
      );
      value = { ...value, nativeSources: sources };
    }
  }
  return { value, texts };
};

/** Field genesis is stable for identical persisted input, while different source bytes have distinct IDs. */
export const openOrderedText = async (
  recordId: string,
  lifetime: string,
  path: string[],
  value: Json,
  saved?: OrderedTextState,
) => {
  const document = new Y.Doc();
  try {
    if (saved) Y.applyUpdate(document, decodeBytes(saved.state));
    else {
      const source = readOrderedPath(value, path);
      const text = typeof source === "string" ? source : "";
      const identity = await fingerprint({ recordId, lifetime, path, text });
      const author = Number.parseInt(identity.slice(0, 8), 16);
      await seedTextDocument(document, text, author, identity);
    }
    const seed = await readTextDocumentSeed(document);
    if (saved && saved.seed !== seed.id) throw new Error("Ordered text source identity changed");
    return { document, seed: seed.id };
  } catch (error) {
    document.destroy();
    throw error;
  }
};

export const prepareOrderedText = async (input: {
  recordId: string;
  lifetime: string;
  path: string[];
  value: Json;
  saved?: OrderedTextState;
  replace?: string;
  edit?: (document: Y.Doc) => void | Promise<void>;
}) => {
  const opened = await openOrderedText(input.recordId, input.lifetime, input.path, input.value, input.saved);
  try {
    // An uninitialized field carries its genesis with its first edit. Later saves send only deltas.
    const before = input.saved ? Y.encodeStateVector(opened.document) : undefined;
    if (input.replace !== undefined) saveTextDocument(opened.document, input.replace);
    await input.edit?.(opened.document);
    return {
      path: input.path,
      seed: opened.seed,
      update: encodeBytes(Y.encodeStateAsUpdate(opened.document, before)),
      dependencies: input.saved?.pending ?? [],
    } satisfies OrderedTextChange;
  } finally {
    opened.document.destroy();
  }
};

/** Merge only declared text. Plain JSON is never traversed or converted into a Yjs value. */
export const mergeOrderedText = (
  value: Json,
  before: Record<string, OrderedTextState>,
  changes: OrderedTextChange[],
  pending?: OrderedTextDependency,
) => {
  const texts = { ...before };
  for (const change of changes) {
    const key = jsonPointer(change.path);
    const saved = Object.hasOwn(texts, key) ? texts[key] : undefined;
    if (saved && saved.seed !== change.seed)
      throw new OrderedTextCausalityError("Ordered text update belongs to a retired source history");
    const document = new Y.Doc();
    try {
      if (saved) Y.applyUpdate(document, decodeBytes(saved.state));
      Y.applyUpdate(document, decodeBytes(change.update));
      if (document.store.pendingStructs || document.store.pendingDs)
        throw new OrderedTextCausalityError("Ordered text update is missing causal history");
      const seeds = [...document.getMap(textDocumentKeys.seeds).keys()];
      // readTextDocumentSeed validates provenance at preparation/admission; require its one root here.
      if (seeds.length !== 1 || seeds[0] !== change.seed)
        throw new Error("Ordered text update has another source history");
      value = applyJsonChanges(value, [{ path: change.path, set: document.getText("content").toString() }]);
      Object.defineProperty(texts, key, {
        value: {
          state: encodeBytes(Y.encodeStateAsUpdate(document)),
          seed: change.seed,
          pending: pending ? [pending] : [],
        },
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } finally {
      document.destroy();
    }
  }
  return { value, texts };
};

const objectFields = (input: unknown, fields: string[]) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid ordered text object");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !fields.includes(key))) throw new Error("Unknown ordered text field");
  return value;
};
const digest = (input: unknown) => {
  if (typeof input !== "string" || !/^[a-f0-9]{64}$/.test(input)) throw new Error("Invalid ordered text digest");
};
const dependencies = (input: unknown) => {
  if (!Array.isArray(input)) throw new Error("Invalid ordered text dependencies");
  const ids = new Set<string>();
  for (const item of input) {
    const value = objectFields(item, ["operationId", "fingerprint"]);
    if (typeof value.operationId !== "string" || !value.operationId || ids.has(value.operationId))
      throw new Error("Invalid ordered text dependency identity");
    ids.add(value.operationId);
    digest(value.fingerprint);
  }
};
const encodedUpdate = (input: unknown) => {
  if (typeof input !== "string") throw new Error("Invalid ordered text update");
  const bytes = decodeBytes(input);
  if (encodeBytes(bytes) !== input) throw new Error("Invalid ordered text encoding");
  Y.decodeUpdate(bytes);
};
export const validateOrderedTextChanges = (input: unknown) => {
  if (!Array.isArray(input)) throw new Error("Invalid ordered text changes");
  const fields = new Set<string>();
  for (const item of input) {
    const value = objectFields(item, ["path", "update", "seed", "dependencies"]);
    if (!Array.isArray(value.path) || !value.path.length || value.path.some((part) => typeof part !== "string"))
      throw new Error("Invalid ordered text path");
    const field = jsonPointer(value.path as string[]);
    if (fields.has(field)) throw new Error("A save must edit each text field once");
    fields.add(field);
    encodedUpdate(value.update);
    digest(value.seed);
    dependencies(value.dependencies);
  }
};
export const validateOrderedTexts = async (input: unknown, value: Json) => {
  const fields = objectFields(input, Object.keys(input as object));
  for (const [pointer, input] of Object.entries(fields)) {
    const saved = objectFields(input, ["state", "seed", "pending"]);
    encodedUpdate(saved.state);
    digest(saved.seed);
    dependencies(saved.pending);
    if ((saved.pending as unknown[]).length) throw new Error("Canonical text cannot contain a pending frontier");
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, decodeBytes(saved.state as string));
      if (document.store.pendingStructs || document.store.pendingDs)
        throw new Error("Ordered text state is missing causal history");
      const seed = await readTextDocumentSeed(document);
      if (seed.id !== saved.seed) throw new Error("Ordered text state has another source identity");
      const { parseJsonPointer } = await import("./ordered-json");
      if (document.getText("content").toString() !== readOrderedPath(value, parseJsonPointer(pointer)))
        throw new Error("Ordered text projection differs from its history");
    } finally {
      document.destroy();
    }
  }
};
