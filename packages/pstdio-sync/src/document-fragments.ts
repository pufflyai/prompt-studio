import * as Y from "yjs";
import { encodeRecordFragment, type FragmentDeletes, type FragmentStruct } from "./document-fragment-encoding";
import { indexRecordRoots } from "./document-fragment-roots";
import { documentRecordOwnership } from "./document-record-ownership";

export interface RecordFragment {
  recordId: string;
  state: Uint8Array;
}

export const captureRecordFragment = (
  document: Y.Doc,
  recordId: string,
  roots: ReturnType<typeof indexRecordRoots>,
) => {
  const kept = new Set<FragmentStruct>();
  const include = (struct: FragmentStruct) => {
    const pending = [struct];
    while (pending.length) {
      const next = pending.pop()!;
      if (kept.has(next)) continue;
      kept.add(next);
      if (!(next instanceof Y.Item)) continue;
      const parent = next.parent;
      const parentId = parent && !(parent instanceof Y.ID) && typeof parent !== "string" ? parent._item?.id : null;
      for (const id of [next.origin, next.rightOrigin, parentId]) if (id) pending.push(Y.getItem(document.store, id));
    }
  };
  const chain = (item: Y.Item | null | undefined, direction: "left" | "right") => {
    while (item) {
      include(item);
      item = item[direction];
    }
  };
  for (const name of ["records", "deleted"]) chain(document.getMap(name)._map.get(recordId), "left");
  for (const name of roots.retired.get(recordId) ?? [])
    chain(document.getMap("retired-records")._map.get(name), "left");
  for (const name of roots.roots.get(recordId) ?? []) {
    const type = document.share.get(name)!;
    chain(type._start, "right");
    for (const item of type._map.values()) chain(item, "left");
  }
  const deletes: FragmentDeletes = new Map();
  for (const struct of [...kept].sort((a, b) => a.id.clock - b.id.clock)) {
    if (!struct.deleted) continue;
    const ranges = deletes.get(struct.id.client) ?? [];
    ranges.push({ clock: struct.id.clock, len: struct.length });
    deletes.set(struct.id.client, ranges);
  }
  return { recordId, state: encodeRecordFragment([...kept], deletes).state } satisfies RecordFragment;
};

/** Explicit backfill. Keep the captured source immutable until the lazy fragments iterator is exhausted. */
export const buildRecordFragments = (document: Y.Doc) => {
  const roots = indexRecordRoots(document);
  const ids = new Set([
    ...document.getMap("records").keys(),
    ...document.getMap("deleted").keys(),
    ...roots.roots.keys(),
    ...roots.retired.keys(),
  ]);
  return {
    fragments: (function* () {
      for (const id of ids) yield captureRecordFragment(document, id, roots);
    })(),
    clocks: Y.decodeStateVector(Y.encodeStateVector(document)),
    ownership: documentRecordOwnership(document),
  };
};
