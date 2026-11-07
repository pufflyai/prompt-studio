import * as Y from "yjs";

interface NamedPath {
  path: string[];
  whole: boolean;
}
type Lifecycle = "create" | "delete" | "restore" | undefined;
const lifecycleFor = (
  name: string,
  item: Y.Item,
  inserted: boolean,
  previous: Lifecycle,
  tombstones: Set<Y.Item>,
): Lifecycle => {
  if (name === "records" && inserted) return item.left === null ? "create" : "restore";
  if (name !== "deleted") return previous ?? "delete";
  if (inserted) {
    tombstones.add(item);
    return "delete";
  }
  // Deleting a deleted record writes a new tombstone, which removes the one it replaces.
  if (tombstones.size > 0 && !tombstones.has(item)) return previous;
  return "restore";
};
const prefix = (name: string, offset: number) => {
  const colon = name.indexOf(":", offset);
  const size = Number(name.slice(offset, colon));
  if (colon < 0 || !Number.isSafeInteger(size) || size < 0) throw new Error("Invalid legacy named value");
  const start = colon + 1;
  return { value: name.slice(start, start + size), end: start + size };
};
const rootKey = (key: string) => {
  if (key === "shared") return ["shared", "value"];
  if (key === "sharedKind") return ["shared", "kind"];
  if (key === "native-text-sources") return ["nativeSources"];
  if (key === "value" || key === "asset") return [key];
  throw new Error(`Unknown legacy record channel ${key}`);
};
const namedPath = (name: string, recordId: string): NamedPath => {
  const record = JSON.stringify(["record", recordId]);
  if (name === record) return { path: [], whole: false };
  if (name === JSON.stringify(["native-text-sources", recordId])) return { path: ["nativeSources"], whole: false };
  const parent = prefix(name, 0);
  const key = prefix(name, parent.end);
  const kind = name.slice(key.end).match(/^:(object|list|text)(?::items|:order)?$/)?.[1];
  if (!kind) throw new Error("Unknown legacy named value kind");
  const before = namedPath(parent.value, recordId);
  if (before.whole) return before;
  const path = [...before.path, ...(parent.value === record ? rootKey(key.value) : [key.value])];
  return { path, whole: kind !== "object" };
};
const rangeItems = (document: Y.Doc, client: number, clock: number, length: number) => {
  const structs = document.store.clients.get(client);
  if (!structs) throw new Error("A pending legacy frame is missing its retained history");
  const selected: Y.Item[] = [];
  for (let index = Y.findIndexSS(structs, clock); index < structs.length; index++) {
    const item = structs[index]!;
    if (item.id.clock >= clock + length) break;
    if (!(item instanceof Y.Item)) throw new Error("Pending legacy paths were garbage collected");
    selected.push(item);
  }
  return selected;
};
export const minimalLegacyPaths = (input: Iterable<string[]>) => {
  const kept = new Set<string>();
  return [...input]
    .sort((a, b) => a.length - b.length)
    .filter((path) => {
      if (path.some((_key, index) => kept.has(JSON.stringify(path.slice(0, index + 1))))) return false;
      kept.add(JSON.stringify(path));
      return true;
    });
};

/** Resolve delta structs/deletions against integrated named types, never diff the clean owner base. */
export const legacyPendingPaths = (document: Y.Doc, recordId: string, bytes: Uint8Array) => {
  const update = Y.decodeUpdate(bytes);
  const paths = new Map<string, string[]>();
  let lifecycle: Lifecycle;
  const objects = new Map<string, string[]>();
  const insertedTombstones = new Set<Y.Item>();
  const visit = (item: Y.Item, inserted = false, object = false) => {
    if (!(item.parent instanceof Y.AbstractType)) throw new Error("Pending legacy item has no retained parent");
    const name = Y.findRootTypeKey(item.parent);
    if (name === "records" || name === "deleted") {
      if (item.parentSub === recordId) lifecycle = lifecycleFor(name, item, inserted, lifecycle, insertedTombstones);
      return;
    }
    const named = namedPath(name, recordId);
    const path = named.whole
      ? named.path
      : [
          ...named.path,
          ...(name === JSON.stringify(["record", recordId]) ? rootKey(item.parentSub!) : [item.parentSub!]),
        ];
    (object && !named.whole ? objects : paths).set(JSON.stringify(path), path);
  };
  for (const struct of update.structs) {
    if (!(struct instanceof Y.Item)) continue;
    const value = struct.content.getContent()[0];
    const object = value && typeof value === "object" && value.kind === "object" && typeof value.name === "string";
    for (const item of rangeItems(document, struct.id.client, struct.id.clock, struct.length))
      visit(item, true, object);
  }
  for (const [client, deleted] of update.ds.clients)
    for (const range of deleted) for (const item of rangeItems(document, client, range.clock, range.len)) visit(item);
  const ancestors = new Set<string>();
  for (const path of paths.values())
    for (let length = 1; length < path.length; length++) ancestors.add(JSON.stringify(path.slice(0, length)));
  for (const [key, path] of objects) if (!ancestors.has(key)) paths.set(key, path);
  return {
    lifecycle,
    paths: minimalLegacyPaths(paths.values()),
  };
};
