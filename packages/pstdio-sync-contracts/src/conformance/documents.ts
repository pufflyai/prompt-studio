import * as Y from "yjs";
import type { SharedEdit } from "../authoring";
import { canonicalJson, fingerprint } from "../fingerprint";
import type { StoredRecord } from "../state";
import type { Change, Json } from "../wire";
import { own, put } from "./dictionary";

export const blank = (recordId: string): StoredRecord => ({
  recordId,
  revision: 0,
  deleted: false,
  primitive: null,
  map: {},
  value: null,
  asset: null,
});
export const cellFingerprint = (map: Record<string, Json>, key: string) =>
  fingerprint({ exists: Object.hasOwn(map, key), value: own(map, key) ?? null });
export const equal = (left: Json, right: Json) => canonicalJson(left) === canonicalJson(right);

function decode(update?: string) {
  const doc = new Y.Doc();
  if (update) Y.applyUpdate(doc, Buffer.from(update, "base64"));
  return doc;
}
const encode = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");

export function visible(record: StoredRecord) {
  const doc = decode(record.shared?.update);
  const result = { ...record, text: doc.getText("body").toString(), list: doc.getArray<Json>("items").toArray() };
  doc.destroy();
  return result;
}

export async function sharedChange(record: StoredRecord, edits: SharedEdit[]) {
  const doc = decode(record.shared?.update);
  const mapEntries: Extract<NonNullable<Change["shared"]>, { kind: "map" }>["entries"] = [];
  let kind: "text" | "list" | "map" | undefined;
  try {
    for (const edit of edits) {
      const nextKind = edit.kind.split(".")[0] as "text" | "list" | "map";
      if (kind && kind !== nextKind) throw new Error("One shared primitive per record");
      kind = nextKind;
      applySharedEdit(doc, edit);
      if (edit.kind === "map.set" || edit.kind === "map.delete") {
        mapEntries.push({
          key: edit.key,
          expected: await cellFingerprint(record.map, edit.key),
          next: edit.kind === "map.set" ? { kind: "set", value: edit.value } : { kind: "delete" },
        });
      }
    }
    if (!kind) throw new Error("Empty shared edit");
    if (kind === "map") return { kind, entries: mapEntries };
    return { kind, update: encode(doc) };
  } finally {
    doc.destroy();
  }
}

export function applyChange(record: StoredRecord, change: Change) {
  const next = structuredClone(record);
  if (change.shared) next.primitive = change.shared.kind;
  if (change.shared?.kind === "map") {
    for (const entry of change.shared.entries) {
      if (entry.next.kind === "delete") delete next.map[entry.key];
      else put(next.map, entry.key, entry.next.value);
    }
  } else if (change.shared) {
    const doc = decode(record.shared?.update);
    try {
      Y.applyUpdate(doc, Buffer.from(change.shared.update, "base64"));
      next.shared = { kind: change.shared.kind, update: encode(doc) };
    } finally {
      doc.destroy();
    }
  }
  if (change.value) next.value = change.value.next;
  if (change.asset) next.asset = change.asset.next;
  next.deleted = change.deleted ?? record.deleted;
  next.revision++;
  return next;
}

function applySharedEdit(doc: Y.Doc, edit: SharedEdit) {
  if (edit.kind === "text.insert") doc.getText("body").insert(edit.index, edit.text);
  if (edit.kind === "text.delete") doc.getText("body").delete(edit.index, edit.count);
  if (edit.kind === "list.insert") doc.getArray<Json>("items").insert(edit.index, edit.values);
  if (edit.kind === "list.delete") doc.getArray<Json>("items").delete(edit.index, edit.count);
}
