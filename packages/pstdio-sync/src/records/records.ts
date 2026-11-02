import {
  type Change,
  canonicalJson,
  fingerprint,
  type Json,
  type SharedEdit,
  type StoredRecord,
} from "pstdio-sync-contracts";
import * as Y from "yjs";
import { decodeBytes, encodeBytes } from "../shared";

const put = <T>(target: Record<string, T>, key: string, value: T) =>
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });

export const blankRecord = (recordId: string) => {
  const record: StoredRecord = {
    recordId,
    revision: 0,
    deleted: false,
    primitive: null,
    map: {},
    value: null,
    asset: null,
  };
  return record;
};

const openDocument = (record: StoredRecord) => {
  const document = new Y.Doc();
  if (record.shared) Y.applyUpdate(document, decodeBytes(record.shared.update));
  return document;
};

const sharedValue = (record: StoredRecord) => {
  if (record.primitive === "map") return { kind: "map" as const, value: structuredClone(record.map) };
  if (!record.primitive) return null;
  const document = openDocument(record);
  try {
    if (record.primitive === "text") return { kind: "text" as const, value: document.getText("body").toString() };
    return { kind: "list" as const, value: document.getArray<Json>("items").toArray() };
  } finally {
    document.destroy();
  }
};

export const publicRecord = (record: StoredRecord) => ({
  recordId: record.recordId,
  exists: record.revision > 0,
  value: structuredClone(record.value),
  asset: structuredClone(record.asset),
  deleted: record.deleted,
  shared: sharedValue(record),
});

export const cellFingerprint = (map: Record<string, Json>, key: string) =>
  fingerprint({ exists: Object.hasOwn(map, key), value: Object.hasOwn(map, key) ? map[key] : null });

export const recordConflict = async (record: StoredRecord, change: Change) => {
  if (record.deleted !== change.baseDeleted) return "delete versus edit";
  if (change.deleted !== undefined && record.revision !== change.expectedRevision) return "delete versus edit";
  if (change.expectedRevision > record.revision) return "unknown base revision";
  if (
    change.asset &&
    canonicalJson(record.asset) !== canonicalJson(change.asset.base) &&
    canonicalJson(record.asset) !== canonicalJson(change.asset.next)
  )
    return "competing asset replacements";
  if (change.value && (await fingerprint(record.value)) !== change.value.expected) return "competing JSON replacements";
  if (change.shared && record.primitive && change.shared.kind !== record.primitive)
    return "incompatible shared primitive";
  if (change.shared?.kind === "map") {
    for (const entry of change.shared.entries)
      if ((await cellFingerprint(record.map, entry.key)) !== entry.expected) return "competing map key edits";
  }
};

const applySequenceEdit = (document: Y.Doc, edit: SharedEdit) => {
  if (edit.kind === "text.insert") document.getText("body").insert(edit.index, edit.text);
  if (edit.kind === "text.delete") document.getText("body").delete(edit.index, edit.count);
  if (edit.kind === "list.insert") document.getArray<Json>("items").insert(edit.index, edit.values);
  if (edit.kind === "list.delete") document.getArray<Json>("items").delete(edit.index, edit.count);
};

export const sharedChange = async (record: StoredRecord, edits: SharedEdit[]) => {
  const document = openDocument(record);
  const entries = new Map<string, Extract<NonNullable<Change["shared"]>, { kind: "map" }>["entries"][number]>();
  let kind: "text" | "list" | "map" | undefined;
  try {
    for (const edit of edits) {
      const nextKind = edit.kind.split(".")[0] as "text" | "list" | "map";
      if (kind && kind !== nextKind) throw new Error("One shared primitive per record");
      kind = nextKind;
      applySequenceEdit(document, edit);
      if (edit.kind === "map.set" || edit.kind === "map.delete") {
        entries.set(edit.key, {
          key: edit.key,
          expected: await cellFingerprint(record.map, edit.key),
          next: edit.kind === "map.set" ? { kind: "set", value: edit.value } : { kind: "delete" },
        });
      }
    }
    if (!kind) throw new Error("Empty shared edit");
    if (kind === "map") return { kind, entries: [...entries.values()] };
    return { kind, update: encodeBytes(Y.encodeStateAsUpdate(document)) };
  } finally {
    document.destroy();
  }
};

export const applyRecordChange = (record: StoredRecord, change: Change) => {
  const next = structuredClone(record);
  if (change.shared) next.primitive = change.shared.kind;
  if (change.shared?.kind === "map") {
    for (const entry of change.shared.entries) {
      if (entry.next.kind === "delete") delete next.map[entry.key];
      else put(next.map, entry.key, entry.next.value);
    }
  } else if (change.shared) {
    const document = openDocument(record);
    try {
      Y.applyUpdate(document, decodeBytes(change.shared.update));
      next.shared = { kind: change.shared.kind, update: encodeBytes(Y.encodeStateAsUpdate(document)) };
    } finally {
      document.destroy();
    }
  }
  if (change.value) next.value = change.value.next;
  if (change.asset) next.asset = change.asset.next;
  next.deleted = change.deleted ?? change.baseDeleted;
  next.revision++;
  return next;
};
