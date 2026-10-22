import type * as Y from "yjs";

type Root = object;
const trackers = new WeakMap<Y.Doc, ReturnType<typeof createTracker>>();

const generationOf = (name: string) => {
  let root = name;
  while (/^\d+:/.test(root)) {
    const start = root.indexOf(":") + 1;
    const length = Number(root.slice(0, start - 1));
    root = root.slice(start, start + length);
  }
  if (!root.startsWith('["record",')) return;
  try {
    const value: unknown = JSON.parse(root);
    if (Array.isArray(value) && value[0] === "record" && typeof value[1] === "string")
      return { root, recordId: value[1] };
  } catch {}
};

const clearType = (document: Y.Doc, name: string, names: WeakMap<Root, string>) => {
  if (name.endsWith(":text")) {
    const text = document.getText(name);
    names.set(text, name);
    if (text.length) text.delete(0, text.length);
  } else if (name.endsWith(":list:order")) {
    const list = document.getArray(name);
    names.set(list, name);
    if (list.length) list.delete(0, list.length);
  } else {
    const map = document.getMap(name);
    names.set(map, name);
    if (map.size) map.clear();
  }
};

const createTracker = (document: Y.Doc) => {
  const records = document.getMap<string>("records");
  const deleted = document.getMap("deleted");
  const retired = document.getMap<boolean>("retired-records");
  const names = new WeakMap<Root, string>();
  const generations = new Map<string, { recordId: string; names: Set<string> }>();
  const entries = document.share.entries();
  let indexed = 0;
  const cleanupOrigin = {};
  const indexNewTypes = () => {
    // Do not exhaust the iterator: it then continues with later Map insertions.
    while (indexed < document.share.size) {
      const next = entries.next();
      if (next.done) break;
      indexed++;
      const [name, type] = next.value;
      names.set(type, name);
      const generation = generationOf(name);
      if (!generation) continue;
      let owned = generations.get(generation.root);
      if (!owned) {
        owned = { recordId: generation.recordId, names: new Set() };
        generations.set(generation.root, owned);
      }
      owned.names.add(name);
    }
  };
  const clear = (root: string) => {
    const owned = generations.get(root);
    if (!owned || !retired.has(root) || records.get(owned.recordId) === root) return;
    for (const name of owned.names) clearType(document, name, names);
  };
  const changedRoots = (type: Root, keys: Set<string | null>) => {
    if (type === retired) return [...keys].filter((key): key is string => key !== null);
    if (type === deleted)
      return [...keys]
        .filter((id): id is string => id !== null && deleted.has(id) && !records.has(id))
        .map((id) => JSON.stringify(["record", id]));
    const name = names.get(type);
    const generation = name && generationOf(name);
    if (!generation) return [];
    const retiredGeneration = retired.has(generation.root);
    // A restore's children may arrive before its live reference. Only the
    // original generation can infer retirement from a legacy deletion.
    const deletedRecord =
      generation.root === JSON.stringify(["record", generation.recordId]) &&
      deleted.has(generation.recordId) &&
      !records.has(generation.recordId);
    return retiredGeneration || deletedRecord ? [generation.root] : [];
  };
  const changed = (transaction: Y.Transaction) => {
    if (transaction.origin === cleanupOrigin) return;
    indexNewTypes();
    const roots = new Set<string>();
    for (const [type, keys] of transaction.changed) for (const root of changedRoots(type, keys)) roots.add(root);
    if (!roots.size) return;
    document.transact(() => {
      for (const root of roots) {
        const owned = generations.get(root);
        if (owned && deleted.has(owned.recordId) && !records.has(owned.recordId) && !retired.has(root))
          retired.set(root, true);
        clear(root);
      }
    }, cleanupOrigin);
  };
  indexNewTypes();
  document.on("afterTransaction", changed);
  return {
    retire(root: string) {
      indexNewTypes();
      if (!retired.has(root)) retired.set(root, true);
      clear(root);
    },
    upgrade() {
      indexNewTypes();
      document.transact(() => {
        for (const id of deleted.keys()) {
          const root = JSON.stringify(["record", id]);
          if (!records.has(id) && !retired.has(root)) retired.set(root, true);
        }
        for (const root of retired.keys()) clear(root);
      });
    },
  };
};

export const trackDocumentPayload = (document: Y.Doc) => {
  let tracker = trackers.get(document);
  if (!tracker) {
    tracker = createTracker(document);
    trackers.set(document, tracker);
  }
  return tracker;
};
