import type * as Y from "yjs";

/** The active records-map item changes on recreation, even when the new bytes are identical. */
export const recordLifetime = (document: Y.Doc, recordId: string) => {
  const records = document.getMap("records");
  if (!records.has(recordId)) return "";
  const item = records._map.get(recordId);
  if (!item) throw new Error("The active record has no causal identity");
  return JSON.stringify([item.id.client, item.id.clock]);
};

export const hasEarlierRecordLifetime = (document: Y.Doc, recordId: string) =>
  document.getMap("records")._map.get(recordId)?.left !== null;
