import { canonicalJson, type Json, type SharedEdit } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import type { DocumentAuthor } from "./document-author";
import { readValue, valueReference, writeValue } from "./document-values";
import type { GroupCommit } from "./types";

const applyShared = (
  document: Y.Doc,
  record: Y.Map<unknown>,
  name: string,
  shared: SharedEdit,
  author?: DocumentAuthor,
) => {
  const kind = shared.kind.split(".")[0];
  if (record.get("sharedKind") !== kind) record.set("sharedKind", kind);
  switch (shared.kind) {
    case "map.set":
    case "map.delete": {
      const reference = valueReference(record, "shared", "object", name);
      const map = document.getMap(reference.name);
      if (shared.kind === "map.set") writeValue(map, shared.key, shared.value, reference.name, author);
      else map.delete(shared.key);
      break;
    }
    case "text.insert":
    case "text.delete": {
      const reference = valueReference(record, "shared", "text", name);
      const text = document.getText(reference.name);
      if (shared.kind === "text.insert") text.insert(shared.index, shared.text);
      else text.delete(shared.index, shared.count);
      break;
    }
    case "list.insert":
    case "list.delete": {
      const values = (record.has("shared") ? readValue(record.get("shared"), document) : []) as Json[];
      if (shared.kind === "list.insert") values.splice(shared.index, 0, ...shared.values);
      else values.splice(shared.index, shared.count);
      writeValue(record, "shared", values, name, author);
      break;
    }
  }
};

export const applyDocumentEdit = (document: Y.Doc, edit: GroupCommit["edits"][number], author?: DocumentAuthor) => {
  const records = document.getMap<string>("records");
  if (edit.deleted) {
    records.delete(edit.recordId);
    document.getMap("deleted").set(edit.recordId, true);
    return;
  }
  let name = records.get(edit.recordId);
  if (!name) {
    if (document.getMap("deleted").has(edit.recordId) && edit.deleted !== false) return;
    name = JSON.stringify(["record", edit.recordId]);
    records.set(edit.recordId, name);
    document.getMap("deleted").delete(edit.recordId);
  }
  const record = document.getMap(name);
  if (Object.hasOwn(edit, "replace")) writeValue(record, "value", edit.replace!, name, author);
  if (edit.asset !== undefined && canonicalJson((record.get("asset") ?? null) as Json) !== canonicalJson(edit.asset))
    record.set("asset", structuredClone(edit.asset));
  for (const shared of edit.shared ?? []) {
    const apply = () => applyShared(document, record, name!, shared, author);
    if (author) author(name, "shared", shared as unknown as Json, apply);
    else apply();
  }
};
