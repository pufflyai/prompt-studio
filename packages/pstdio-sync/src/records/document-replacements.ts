import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import { listKeys, readValue } from "./document-values";

type RecordChannels = Partial<Record<"value" | "asset" | "shared", Json>>;
export type DocumentSnapshot = Map<string, RecordChannels>;

/** Public reads use null defaults. Diagnostics must distinguish those defaults from stored nulls. */
export const snapshotDocumentRecords = (document: Y.Doc) => {
  const records: DocumentSnapshot = new Map();
  for (const [id, name] of document.getMap<string>("records")) {
    const record = document.getMap(name);
    const channels: RecordChannels = {};
    if (record.has("value")) channels.value = readValue(record.get("value"), document);
    if (record.has("asset")) channels.asset = structuredClone(record.get("asset")) as Json;
    if (record.has("shared"))
      channels.shared = { kind: record.get("sharedKind") as string, value: readValue(record.get("shared"), document) };
    records.set(id, channels);
  }
  return records;
};

export interface DocumentReplacement {
  recordId: string;
  path: (string | number)[];
  kept: Json | undefined;
  replaced: Json | undefined;
}

const equal = (left: Json | undefined, right: Json | undefined) =>
  left === right || (left !== undefined && right !== undefined && canonicalJson(left) === canonicalJson(right));

const object = (value: Json | undefined) =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;

const concurrent = (before: Json | undefined, left: Json | undefined, right: Json | undefined) =>
  !equal(left, right) && !equal(before, left) && !equal(before, right);

/** Describe lost concurrent values without choosing winners; the merged document owns that decision. */
export const findDocumentReplacements = (
  base: DocumentSnapshot,
  first: DocumentSnapshot,
  second: DocumentSnapshot,
  merged: DocumentSnapshot,
) => {
  const replacements: DocumentReplacement[] = [];
  const report = (
    recordId: string,
    path: DocumentReplacement["path"],
    before: Json | undefined,
    left: Json | undefined,
    right: Json | undefined,
    kept: Json | undefined,
  ) => {
    if (!concurrent(before, left, right)) return;
    if (equal(kept, left)) replacements.push({ recordId, path, kept, replaced: right });
    else if (equal(kept, right)) replacements.push({ recordId, path, kept, replaced: left });
  };
  const visit = (
    recordId: string,
    path: DocumentReplacement["path"],
    before: Json | undefined,
    left: Json | undefined,
    right: Json | undefined,
    kept: Json | undefined,
  ) => {
    if (!concurrent(before, left, right)) return;
    const leftObject = object(left);
    const rightObject = object(right);
    const keptObject = object(kept);
    if (leftObject && rightObject && keptObject) {
      const original = object(before);
      for (const key of [...new Set([...Object.keys(leftObject), ...Object.keys(rightObject)])].sort())
        visit(recordId, [...path, key], original?.[key], leftObject[key], rightObject[key], keptObject[key]);
      return;
    }
    if (Array.isArray(left) && Array.isArray(right) && Array.isArray(kept)) {
      const original = Array.isArray(before) ? before : [];
      const indexed = (values: Json[]) => new Map(listKeys(values).map((key, index) => [key, values[index]]));
      const originalItems = indexed(original);
      const leftItems = indexed(left);
      const rightItems = indexed(right);
      const keptItems = indexed(kept);
      const keptKeys = listKeys(kept);
      const removedKeys = [...new Set([...listKeys(left), ...listKeys(right)])]
        .filter((key) => !keptItems.has(key))
        .sort();
      const keys = [...keptKeys, ...removedKeys];
      for (const [index, key] of keys.entries())
        visit(
          recordId,
          [...path, index],
          originalItems.get(key),
          leftItems.get(key),
          rightItems.get(key),
          keptItems.get(key),
        );
      return;
    }
    // Text and lists may retain both edits. Only a value replaced by the merge belongs in this report.
    report(recordId, path, before, left, right, kept);
  };
  for (const id of [...new Set([...first.keys(), ...second.keys()])].sort()) {
    // Removing a record also hides channels that did not exist before the other device added them.
    if (base.has(id) && !merged.has(id)) {
      const survivor = first.get(id) ?? second.get(id);
      for (const key of ["value", "asset", "shared"] as const) {
        const replaced = survivor?.[key];
        if (replaced !== undefined && !equal(base.get(id)?.[key], replaced))
          replacements.push({ recordId: id, path: [key], kept: undefined, replaced });
      }
      continue;
    }
    for (const key of ["value", "asset", "shared"] as const) {
      const inspect = key === "asset" ? report : visit;
      inspect(id, [key], base.get(id)?.[key], first.get(id)?.[key], second.get(id)?.[key], merged.get(id)?.[key]);
    }
  }
  return replacements;
};
