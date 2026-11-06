import { fingerprint, type Json } from "pstdio-sync-contracts";

/** Observed values without retaining old text, arrays or scalar content. */
export type ObservedJson = { kind: "object"; fields: Record<string, ObservedJson> } | { kind: "value"; digest: string };

export type JsonChange = { path: string[] } & ({ set: Json } | { remove: true });

const object = (value: Json | undefined) =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;

/** Arrays and strings are whole leaves. A line break never opts a value into text merging. */
export const observeJson = async (value: Json) => {
  const root: { observed?: ObservedJson } = {};
  const pending = [
    {
      value,
      save: (observed: ObservedJson) => {
        root.observed = observed;
      },
    },
  ];
  while (pending.length) {
    const next = pending.pop()!;
    const fields = object(next.value);
    if (!fields) {
      next.save({ kind: "value", digest: await fingerprint(next.value) });
      continue;
    }
    const children: Record<string, ObservedJson> = {};
    next.save({ kind: "object", fields: children });
    for (const [key, child] of Object.entries(fields))
      pending.push({
        value: child,
        save: (observed) => {
          Object.defineProperty(children, key, {
            value: observed,
            enumerable: true,
            writable: true,
            configurable: true,
          });
        },
      });
  }
  return root.observed!;
};

/** Derive a replacement's changed paths from the actual observed baseline, including absent keys. */
export const replacementChanges = async (observed: ObservedJson | undefined, replacement: Json) => {
  const changes: JsonChange[] = [];
  const pending = [{ before: observed, next: replacement, path: [] as string[] }];
  const addFields = (
    before: Extract<ObservedJson, { kind: "object" }> | undefined,
    fields: Record<string, Json>,
    path: string[],
  ) => {
    const previous = before?.fields ?? {};
    // Empty new objects have no leaf to create their presence. Scalar/array-to-object replacements
    // below remain whole-parent writes, so an intentional type change replaces its old subtree.
    if (!before && !Object.keys(fields).length) changes.push({ path, set: {} });
    for (const key of Object.keys(previous))
      if (!Object.hasOwn(fields, key)) changes.push({ path: [...path, key], remove: true });
    for (const [key, next] of Object.entries(fields))
      pending.push({ before: Object.hasOwn(previous, key) ? previous[key] : undefined, next, path: [...path, key] });
  };
  while (pending.length) {
    const { before, next, path } = pending.pop()!;
    const fields = object(next);
    if (fields && (!before || before.kind === "object")) {
      addFields(before, fields, path);
      continue;
    }
    if (before?.kind === "value" && before.digest === (await fingerprint(next))) continue;
    changes.push({ path, set: structuredClone(next) });
  }
  return changes;
};

export const pathsOverlap = (first: string[], second: string[]) =>
  first.slice(0, Math.min(first.length, second.length)).every((part, index) => part === second[index]);

/** JSON Pointer keeps dots, slashes, tildes, empty keys and numeric object keys unambiguous. */
export const jsonPointer = (path: string[]) =>
  path.map((part) => `/${part.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

export const parseJsonPointer = (pointer: string) => {
  if (pointer === "") return [];
  if (!pointer.startsWith("/") || /~(?![01])/u.test(pointer)) throw new Error("Invalid JSON Pointer");
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
};

export const validateJsonChanges = (changes: JsonChange[]) => {
  const paths = changes
    .map((change) => change.path)
    .sort((first, second) => {
      for (let index = 0; index < Math.min(first.length, second.length); index++) {
        if (first[index] === second[index]) continue;
        return first[index]! < second[index]! ? -1 : 1;
      }
      return first.length - second.length;
    });
  for (let index = 1; index < paths.length; index++) {
    if (pathsOverlap(paths[index - 1]!, paths[index]!)) throw new Error("A save cannot write overlapping JSON paths");
  }
};

const own = (value: { [key: string]: Json }, key: string) => (Object.hasOwn(value, key) ? value[key] : undefined);
const editableParent = (root: Record<string, Json>, owned: WeakSet<object>, path: string[], remove: boolean) => {
  let target = root;
  for (const key of path.slice(0, -1)) {
    const child = object(own(target, key));
    if (!child && remove) return;
    if (child && owned.has(child)) target = child;
    else {
      const next = { ...child };
      owned.add(next);
      Object.defineProperty(target, key, { value: next, enumerable: true, writable: true, configurable: true });
      target = next;
    }
  }
  return target;
};
/** Apply already-ordered plain changes. A later child write recreates its object after a parent replacement. */
export const applyJsonChanges = (current: Json, changes: JsonChange[]) => {
  validateJsonChanges(changes);
  if (!changes.length) return current;
  const root = changes.find((change) => !change.path.length);
  if (root) return "set" in root ? structuredClone(root.set) : null;
  if (!object(current) && changes.every((change) => "remove" in change)) return current;
  const result = { ...object(current) };
  const owned = new WeakSet<object>([result]);
  for (const change of changes) {
    const target = editableParent(result, owned, change.path, "remove" in change);
    if (!target) continue;
    const key = change.path.at(-1)!;
    if ("remove" in change) delete target[key];
    else
      Object.defineProperty(target, key, {
        value: structuredClone(change.set),
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
  return result;
};

interface PathNode {
  stamp?: string;
  children: Map<string, PathNode>;
}
const pathNode = () => {
  const node: PathNode = { children: new Map() };
  return node;
};
const pathNodeFor = (root: PathNode, path: string[]) => {
  let current = root;
  for (const key of path) {
    let next = current.children.get(key);
    if (!next) {
      next = pathNode();
      current.children.set(key, next);
    }
    current = next;
  }
  return current;
};
const pathTree = (stamps: Record<string, string>) => {
  const root = pathNode();
  for (const [pointer, stamp] of Object.entries(stamps)) pathNodeFor(root, parseJsonPointer(pointer)).stamp = stamp;
  return root;
};
const treeStamps = (root: PathNode) => {
  const entries: [string, string][] = [];
  const pending = [{ node: root, path: [] as string[] }];
  while (pending.length) {
    const { node, path } = pending.pop()!;
    if (node.stamp !== undefined) entries.push([jsonPointer(path), node.stamp]);
    for (const [key, child] of node.children) pending.push({ node: child, path: [...path, key] });
  }
  return Object.fromEntries(entries);
};
const overlapsTree = (root: PathNode, path: string[]) => {
  let current = root;
  for (const key of path) {
    if (current.stamp !== undefined) return true;
    const next = current.children.get(key);
    if (!next) return false;
    current = next;
  }
  return current.stamp !== undefined || current.children.size > 0;
};

/** Stamps describe writes rather than current content, so changing a value back still changes its revision. */
export const stampJsonChanges = (previous: Record<string, string>, changes: JsonChange[], operationId: string) => {
  const root = pathTree(previous);
  for (const change of changes) {
    const node = pathNodeFor(root, change.path);
    node.children.clear();
    node.stamp = operationId;
  }
  return treeStamps(root);
};

/** Sibling writes do not refuse a careful save; parent/child changes and removals do. */
export const unchangedJsonPaths = (
  observed: Record<string, string>,
  current: Record<string, string>,
  changes: JsonChange[],
) => {
  const writes = pathNode();
  for (const change of changes) pathNodeFor(writes, change.path).stamp = "write";
  for (const pointer of new Set([...Object.keys(observed), ...Object.keys(current)])) {
    if (observed[pointer] === current[pointer]) continue;
    if (overlapsTree(writes, parseJsonPointer(pointer))) return false;
  }
  return true;
};

/** Select condition dependencies without scanning every written path for every observed field. */
export const overlappingJsonStamps = (stamps: Record<string, string>, changes: JsonChange[]) => {
  const writes = pathNode();
  for (const change of changes) pathNodeFor(writes, change.path).stamp = "write";
  return Object.fromEntries(
    Object.entries(stamps).filter(([pointer]) => overlapsTree(writes, parseJsonPointer(pointer))),
  );
};
