import { canonicalJson, type Json, type SharedEdit, type StorageGroup } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import { readValue } from "./document-values";

const sequenceRange = (index: number, count: number, length: number) => {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index > length ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    index + count > length
  )
    throw new Error("Shared edit is outside the current sequence");
};
const validateSequence = (value: Json, shared: SharedEdit) => {
  switch (shared.kind) {
    case "text.insert":
    case "text.delete": {
      const text = typeof value === "string" ? value : "";
      const count = shared.kind === "text.delete" ? shared.count : 0;
      sequenceRange(shared.index, count, text.length);
      return (
        text.slice(0, shared.index) +
        (shared.kind === "text.insert" ? shared.text : "") +
        text.slice(shared.index + count)
      );
    }
    case "list.insert":
    case "list.delete": {
      const list = Array.isArray(value) ? value : [];
      const count = shared.kind === "list.delete" ? shared.count : 0;
      sequenceRange(shared.index, count, list.length);
      list.splice(shared.index, count, ...(shared.kind === "list.insert" ? shared.values : []));
      return list;
    }
    default:
      return value;
  }
};
const validateEdit = (document: Y.Doc, edit: StorageGroup["edits"][number]) => {
  if (!Object.hasOwn(edit, "replace") && edit.asset === undefined && edit.deleted === undefined && !edit.shared?.length)
    throw new Error("Empty record edit");
  if (Object.hasOwn(edit, "replace")) canonicalJson(edit.replace!);
  const name = document.getMap<string>("records").get(edit.recordId);
  const record = name ? document.getMap(name) : undefined;
  let kind = record?.get("sharedKind");
  let value: Json = record ? readValue(record.get("shared"), document) : null;
  for (const shared of edit.shared ?? []) {
    const nextKind = shared.kind.split(".")[0];
    if (kind && kind !== nextKind) throw new Error("One shared primitive per record");
    kind = nextKind;
    value = validateSequence(value, shared);
  }
};

/** Yjs transactions do not roll back. Validate all edits before touching shared state. */
export const validateDocumentGroup = (document: Y.Doc, group: StorageGroup) => {
  if (!group.operationId || !group.edits.length) throw new Error("Empty storage commit");
  const seen = new Set<string>();
  for (const edit of group.edits) {
    if (!edit.recordId || seen.has(edit.recordId)) throw new Error("A commit must name each record once");
    seen.add(edit.recordId);
    validateEdit(document, edit);
  }
};
