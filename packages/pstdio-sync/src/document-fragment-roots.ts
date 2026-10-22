import type * as Y from "yjs";

export const recordIdFromRoot = (name: string) => {
  while (/^\d+:/.test(name)) {
    const start = name.indexOf(":") + 1;
    name = name.slice(start, start + Number(name.slice(0, start - 1)));
  }
  if (!name.startsWith('["record",')) return;
  try {
    const parts: unknown = JSON.parse(name);
    if (Array.isArray(parts) && parts[0] === "record" && typeof parts[1] === "string") return parts[1];
  } catch {}
};

/** Enumerate only during explicit source backfill or inside an already bounded view. */
export const indexRecordRoots = (document: Y.Doc) => {
  const roots = new Map<string, string[]>();
  const retired = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, id: string | undefined, name: string) => {
    if (id === undefined) return;
    const names = map.get(id) ?? [];
    names.push(name);
    map.set(id, names);
  };
  for (const [name, type] of document.share) {
    // Decoding a pending update can create an empty root before any item integrates.
    if (type._start || type._map.size) add(roots, recordIdFromRoot(name), name);
  }
  for (const name of document.getMap("retired-records")._map.keys()) add(retired, recordIdFromRoot(name), name);
  return { roots, retired };
};
