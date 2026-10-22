import * as Y from "yjs";
import { recordIdFromRoot } from "./document-fragment-roots";

export interface RecordOwnershipRange {
  client: number;
  startClock: number;
  endClock: number;
  recordId: string;
}

/** Original clock ownership is stable even after its payload is deleted or compacted. */
export function* documentRecordOwnership(document: Y.Doc) {
  const names = new WeakMap<object, string>();
  for (const [name, type] of document.share) names.set(type, name);
  const owner = (item: Y.Item) => {
    let rootItem = item;
    let parent = item.parent;
    while (parent && typeof parent === "object" && !(parent instanceof Y.ID) && parent._item) {
      rootItem = parent._item;
      parent = rootItem.parent;
    }
    if (!parent || typeof parent !== "object") return;
    const name = names.get(parent);
    if (name === "records" || name === "deleted") return rootItem.parentSub ?? undefined;
    if (name === "retired-records") return rootItem.parentSub ? recordIdFromRoot(rootItem.parentSub) : undefined;
    return name ? recordIdFromRoot(name) : undefined;
  };
  for (const [client, structs] of document.store.clients) {
    let range: RecordOwnershipRange | undefined;
    for (const struct of structs) {
      const recordId = struct instanceof Y.Item ? owner(struct) : undefined;
      if (range && recordId === range.recordId && struct.id.clock === range.endClock) {
        range.endClock = struct.id.clock + struct.length;
        continue;
      }
      if (range) yield range;
      range =
        recordId === undefined
          ? undefined
          : { client, recordId, startClock: struct.id.clock, endClock: struct.id.clock + struct.length };
    }
    if (range) yield range;
  }
}
