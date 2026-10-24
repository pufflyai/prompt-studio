import { fingerprint, type StorageRecord } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import { readValue } from "./document-values";

export const readDocumentRecord = async (document: Y.Doc, recordId: string) => {
  const name = document.getMap<string>("records").get(recordId);
  const record = name ? document.getMap(name) : undefined;
  const deleted = !record && document.getMap("deleted").has(recordId);
  const shared = record?.get("sharedKind") as "map" | "text" | "list" | undefined;
  const value = record ? readValue(record.get("value"), document) : null;
  const asset = structuredClone((record?.get("asset") ?? null) as StorageRecord["asset"]);
  const sharedValue = shared
    ? ({ kind: shared, value: readValue(record?.get("shared"), document) } as StorageRecord["shared"])
    : null;
  return {
    recordId,
    exists: !!record || deleted,
    deleted,
    value,
    asset,
    shared: sharedValue,
    revision: await fingerprint({ value, asset, shared: sharedValue, deleted }),
  } satisfies StorageRecord;
};

export interface RecordType {
  name: string;
  kind: "map" | "list" | "text";
}

/** Follow only this record's visible references. Named types have no Yjs parent link. */
export const documentRecordTypes = (document: Y.Doc, id: string) => {
  const name = document.getMap<string>("records").get(id);
  if (!name) return [];
  const types: RecordType[] = [];
  const visit = (type: RecordType) => {
    types.push(type);
    if (type.kind !== "map") return;
    for (const value of document.getMap(type.name).values()) {
      if (!value || typeof value !== "object" || !("kind" in value) || !("name" in value)) continue;
      const reference = value as { kind: string; name: string };
      if (reference.kind === "object") visit({ name: reference.name, kind: "map" });
      if (reference.kind === "text") visit({ name: reference.name, kind: "text" });
      if (reference.kind === "list") {
        visit({ name: `${reference.name}:items`, kind: "map" });
        visit({ name: `${reference.name}:order`, kind: "list" });
      }
    }
  };
  visit({ name, kind: "map" });
  return types;
};
