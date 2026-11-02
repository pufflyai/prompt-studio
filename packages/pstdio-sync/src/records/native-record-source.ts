import { type Asset, canonicalJson, type Json, type StorageGroup } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { encodeBytes, NativeSourceRecoveryError } from "../shared";
import { recordTypeName } from "./document-edits";
import { readValue } from "./document-values";
import { compatibleNativeAssets, type NativeAssetSource } from "./native-asset-source";
import { hasEarlierRecordLifetime, recordLifetime } from "./record-lifetime";

export type NativeRecordField = {
  lifetime: string;
  field: string;
  /** Retained to detect edits saved by an older, unbound writer. Never overwritten. */
  original: string;
};
export type NativeRecordSources = Record<string, NativeRecordField | NativeAssetSource>;
const sourcesKey = "native-text-sources";
const validField = (source: NativeRecordField) =>
  typeof source.field === "string" && typeof source.original === "string";
const sourceMapName = (recordId: string) => JSON.stringify([sourcesKey, recordId]);
const validateLifetimes = (document: Y.Doc, recordId: string, sources: NativeRecordSources) => {
  const lifetime = recordLifetime(document, recordId);
  for (const source of Object.values(sources))
    if (source.lifetime !== lifetime)
      throw new NativeSourceRecoveryError(
        "This file was recreated outside its shared text history. Both saved versions need recovery.",
        recordId,
      );
};
const sourceMap = (document: Y.Doc, recordId: string, create = false) => {
  const record = document.getMap(recordTypeName(recordId));
  const reference = record.get(sourcesKey) as { kind: string; name: string } | undefined;
  const name = sourceMapName(recordId);
  if (!reference && !create) return undefined;
  if (reference && (reference.kind !== "object" || reference.name !== name))
    throw new Error("Invalid native source reference");
  if (!reference) record.set(sourcesKey, { kind: "object", name });
  return document.getMap<NativeRecordSources[string]>(name);
};

/** Adds ownership metadata without reading or copying the record's CRDT history. */
export const recordTextBindingUpdate = (recordId: string, key: string, source: NativeRecordSources[string]) => {
  const document = new Y.Doc();
  try {
    sourceMap(document, recordId, true)!.set(key, source);
    return Y.encodeStateAsUpdate(document);
  } finally {
    document.destroy();
  }
};

const fieldPath = (field: string) => {
  if (!field.startsWith("/")) throw new Error("A native text field must use a JSON pointer");
  return field
    .slice(1)
    .split("/")
    .map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"));
};
export const nativeFieldValue = (value: Json, field: string) => {
  let current: Json | undefined = value;
  for (const key of fieldPath(field)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = Object.hasOwn(current, key) ? current[key] : undefined;
  }
  return current;
};
export const setNativeFieldValue = (value: Record<string, Json>, field: string, content: string) => {
  const path = fieldPath(field);
  let current = value;
  for (const key of path.slice(0, -1)) {
    const next = Object.hasOwn(current, key) ? current[key] : undefined;
    if (next && typeof next === "object" && !Array.isArray(next)) current = next;
    else {
      const object: Record<string, Json> = {};
      Object.defineProperty(current, key, { value: object, enumerable: true, writable: true, configurable: true });
      current = object;
    }
  }
  Object.defineProperty(current, path.at(-1)!, {
    value: content,
    enumerable: true,
    writable: true,
    configurable: true,
  });
};

export const readNativeRecordSources = (document: Y.Doc, recordId: string) => {
  if (!document.getMap("records").has(recordId)) return {};
  const record = document.getMap(recordTypeName(recordId));
  const sources = Object.fromEntries(sourceMap(document, recordId) ?? []) as NativeRecordSources;
  validateLifetimes(document, recordId, sources);
  const fields = new Set<string>();
  let assetSeen = false;
  const value = readValue(record.get("value"), document);
  for (const [key, source] of Object.entries(sources)) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid native text source binding");
    if ("asset" in source) {
      if (assetSeen) throw new NativeSourceRecoveryError("A file has conflicting native text bindings", recordId);
      assetSeen = true;
      if (canonicalJson((record.get("asset") ?? null) as Json) !== canonicalJson(source.asset as unknown as Json))
        throw new NativeSourceRecoveryError(
          "A pre-binding file edit needs recovery; its original asset is preserved",
          recordId,
        );
      continue;
    }
    if (!validField(source)) throw new Error("Invalid native text field binding");
    if (fields.has(source.field))
      throw new NativeSourceRecoveryError("A record field has conflicting native text bindings", recordId);
    fields.add(source.field);
    if (nativeFieldValue(value, source.field) !== source.original)
      throw new NativeSourceRecoveryError(
        "A pre-binding text edit needs recovery; its original record is preserved",
        recordId,
      );
  }
  return structuredClone(sources);
};

/** Recreating a deleted record starts a new file lifetime, independent of its old shared text. */
export const resetRecreatedNativeSource = (document: Y.Doc, edit: StorageGroup["edits"][number]) => {
  if (edit.deleted !== false || !document.getMap("deleted").has(edit.recordId)) return;
  sourceMap(document, edit.recordId)?.clear();
  document.getMap(recordTypeName(edit.recordId)).delete(sourcesKey);
};

const sameOriginalSource = (left: NativeRecordSources[string], right: NativeRecordSources[string]) => {
  if ("asset" in left && "asset" in right) return compatibleNativeAssets(left, right);
  return "field" in left && "field" in right && left.field === right.field && left.original === right.original;
};

export const adoptNativeRecordSources = async (local: Y.Doc, remote: Y.Doc, recordId: string) => {
  if (!local.getMap("records").has(recordId) || !remote.getMap("records").has(recordId)) return;
  const left = readNativeRecordSources(local, recordId);
  const right = readNativeRecordSources(remote, recordId);
  if (
    (Object.keys(left).length || Object.keys(right).length) &&
    (hasEarlierRecordLifetime(local, recordId) || hasEarlierRecordLifetime(remote, recordId))
  )
    throw new NativeSourceRecoveryError(
      "An unrelated file recreation needs recovery before its shared text can be adopted",
      recordId,
    );
  const validate = (document: Y.Doc, sources: NativeRecordSources) => {
    const record = document.getMap(recordTypeName(recordId));
    const value = readValue(record.get("value"), document);
    for (const source of Object.values(sources)) {
      const matches =
        "field" in source
          ? nativeFieldValue(value, source.field) === source.original
          : canonicalJson((record.get("asset") ?? null) as Json) === canonicalJson(source.asset as unknown as Json);
      if (!matches)
        throw new NativeSourceRecoveryError(
          "A saved pre-binding source differs from the shared source; both copies need recovery",
          recordId,
        );
    }
  };
  validate(local, right);
  validate(remote, left);
  for (const [key, source] of Object.entries(left)) {
    const adopted = { ...source, lifetime: recordLifetime(remote, recordId) };
    if (right[key] && !(await sameOriginalSource(source, right[key])))
      throw new NativeSourceRecoveryError(
        "A source has different pre-binding histories; both copies need recovery",
        recordId,
      );
    if (!right[key]) sourceMap(remote, recordId, true)!.set(key, adopted);
  }
  readNativeRecordSources(remote, recordId);
};

export const bindRecordText = (document: Y.Doc, recordId: string, input: { documentKey: string; field: string }) => {
  if (!document.getMap("records").has(recordId)) throw new Error("The native text source no longer exists");
  const record = document.getMap(recordTypeName(recordId));
  const sources = readNativeRecordSources(document, recordId);
  const existing = Object.entries(sources).find(([, source]) => "field" in source && source.field === input.field);
  if (existing) {
    if (existing[0] !== input.documentKey) throw new Error("This record field already has a text source");
    return sources;
  }
  const value = readValue(record.get("value"), document);
  const original = nativeFieldValue(value, input.field);
  if (typeof original !== "string") throw new Error("A native text source must bind an existing string field");
  const next = {
    ...sources,
    [input.documentKey]: { field: input.field, original, lifetime: recordLifetime(document, recordId) },
  };
  sourceMap(document, recordId, true)!.set(input.documentKey, next[input.documentKey]!);
  return next;
};

export const bindRecordTextAsset = (document: Y.Doc, recordId: string, documentKey: string, baseline: Uint8Array) => {
  if (!document.getMap("records").has(recordId)) throw new Error("The native text source no longer exists");
  const record = document.getMap(recordTypeName(recordId));
  const sources = readNativeRecordSources(document, recordId);
  const existing = Object.entries(sources).find(([, source]) => "asset" in source);
  if (existing && existing[0] !== documentKey) throw new Error("This file already has a text source");
  const asset = record.get("asset") as Asset | undefined;
  if (!asset) throw new Error("A text file must bind an existing asset");
  if (!existing)
    sourceMap(document, recordId, true)!.set(documentKey, {
      asset,
      baseline: encodeBytes(baseline),
      lifetime: recordLifetime(document, recordId),
    });
};

export const nativeTextAssetKey = (record: { recordId: string; nativeSources?: NativeRecordSources }) =>
  Object.entries(record.nativeSources ?? {}).find(([, source]) => "asset" in source)?.[0];

/** Bound text is written to its standalone document; metadata edits never create a second text history. */
export const prepareRecordTextEdit = (
  document: Y.Doc,
  edit: StorageGroup["edits"][number],
  write: (input: { documentKey: string; content: string }) => void,
) => {
  const sources = readNativeRecordSources(document, edit.recordId);
  if (
    !edit.deleted &&
    edit.asset !== undefined &&
    Object.values(sources).some(
      (source) =>
        "asset" in source &&
        canonicalJson(edit.asset as unknown as Json) !== canonicalJson(source.asset as unknown as Json),
    )
  )
    throw new Error("A bound file must be written through its text source");
  if (!Object.keys(sources).length || edit.deleted || !Object.hasOwn(edit, "replace")) return edit;
  if (!edit.replace || typeof edit.replace !== "object" || Array.isArray(edit.replace))
    throw new Error("A record with bound text must keep its object value");
  const replace: Record<string, Json> = structuredClone(edit.replace);
  for (const [documentKey, source] of Object.entries(sources)) {
    if (!("field" in source)) continue;
    const content = nativeFieldValue(replace, source.field) ?? "";
    if (typeof content !== "string") throw new Error("A bound text field must remain a string");
    write({ documentKey, content });
    setNativeFieldValue(replace, source.field, source.original);
  }
  return { ...edit, replace };
};
