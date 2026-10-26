import {
  canonicalJson,
  type Json,
  type SharedEdit,
  type StorageGroup,
  type StorageRecord,
} from "pstdio-sync-contracts";
import type * as Y from "yjs";
import { recordTypeName } from "./document-edits";
import { normalizeDocumentJson } from "./document-json";
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
    case "map.set":
      return { ...(value as Record<string, Json>), [shared.key]: shared.value };
    case "map.delete": {
      const map = { ...(value as Record<string, Json>) };
      delete map[shared.key];
      return map;
    }
  }
};

/** The record as the edit leaves it, so limits apply before anything is written. */
const validateEdit = (document: Y.Doc, edit: StorageGroup["edits"][number]) => {
  if (!Object.hasOwn(edit, "replace") && edit.asset === undefined && edit.deleted === undefined && !edit.shared?.length)
    throw new Error("Empty record edit");
  if (Object.hasOwn(edit, "replace")) canonicalJson(edit.replace!);
  const live = document.getMap<string>("records").get(edit.recordId);
  const tombstoned = !live && document.getMap("deleted").has(edit.recordId);
  // A restored record reconnects the content its document kept when it was deleted.
  const retained = recordTypeName(edit.recordId);
  const name = live ?? (tombstoned && edit.deleted === false && document.share.has(retained) ? retained : undefined);
  const record = name ? document.getMap(name) : undefined;
  let kind = record?.get("sharedKind") as string | undefined;
  let value: Json = record ? readValue(record.get("shared"), document) : null;
  for (const input of edit.shared ?? []) {
    const shared = normalizeDocumentJson(input as unknown as Json) as unknown as SharedEdit;
    const nextKind = shared.kind.split(".")[0];
    if (kind && kind !== nextKind) throw new Error("One shared primitive per record");
    kind = nextKind;
    value = validateSequence(value, shared);
  }
  let saved: Json = record ? readValue(record.get("value"), document) : null;
  if (Object.hasOwn(edit, "replace")) saved = normalizeDocumentJson(edit.replace!);
  const deleted = edit.deleted === true || (tombstoned && edit.deleted !== false);
  return {
    recordId: edit.recordId,
    deleted,
    value: saved,
    shared: kind ? ({ kind, value } as StorageRecord["shared"]) : null,
  };
};

/** Yjs transactions do not roll back. Validate all edits before touching shared state. */
export const validateDocumentGroup = (document: Y.Doc, group: StorageGroup) => {
  if (!group.operationId || !group.edits.length) throw new Error("Empty storage commit");
  const seen = new Set<string>();
  return group.edits.map((edit) => {
    if (!edit.recordId || seen.has(edit.recordId)) throw new Error("A commit must name each record once");
    seen.add(edit.recordId);
    return validateEdit(document, edit);
  });
};
