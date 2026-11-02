import { canonicalJson, type Json } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { documentAuthorId } from "../shared";
import { writeText } from "../text";
import type { DocumentAuthor } from "./document-author";

interface ValueReference {
  kind: "object" | "list" | "text";
  name: string;
}

export const readValue = (value: unknown, document: Y.Doc): Json => {
  if (value === null || typeof value !== "object") return (value ?? null) as Json;
  const reference = value as ValueReference;
  if (reference.kind === "text") return document.getText(reference.name).toString();
  if (reference.kind === "list") {
    const items = document.getMap(`${reference.name}:items`);
    const order = document.getArray<string>(`${reference.name}:order`).toArray();
    const seen = new Set<string>();
    const visible: string[] = [];
    for (let index = order.length - 1; index >= 0; index--) {
      const key = order[index];
      if (items.has(key) && !seen.has(key)) visible.push(key);
      seen.add(key);
    }
    return visible.reverse().map((key) => readValue(items.get(key), document));
  }
  return Object.fromEntries(
    [...document.getMap(reference.name)].map(([key, entry]) => [key, readValue(entry, document)]),
  );
};

export const listKeys = (values: Json[]) => {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const identity =
      value && typeof value === "object" && !Array.isArray(value) && "id" in value
        ? canonicalJson(["id", value.id])
        : canonicalJson(["value", value]);
    const occurrence = seen.get(identity) ?? 0;
    seen.set(identity, occurrence + 1);
    return canonicalJson([identity, occurrence]);
  });
};

// Named children let concurrent creation of the same object merge its keys too.
// Removing a reference hides its descendants, including edits received after deletion.
export const valueReference = (parent: Y.Map<unknown>, key: string, kind: ValueReference["kind"], path: string) => {
  const current = parent.get(key) as ValueReference | undefined;
  if (current?.kind === kind) return current;
  const reference = { kind, name: `${path.length}:${path}${key.length}:${key}:${kind}` };
  parent.set(key, reference);
  return reference;
};

const writeList = (document: Y.Doc, name: string, values: Json[], author?: DocumentAuthor) => {
  const items = document.getMap(`${name}:items`);
  const order = document.getArray<string>(`${name}:order`);
  const keys = listKeys(values);
  const wanted = new Set(keys);
  for (const key of items.keys()) if (!wanted.has(key)) items.delete(key);
  for (let index = 0; index < keys.length; index++)
    writeValue(items, keys[index], values[index], `${name}:items`, author);
  const current = order.toArray();
  const seen = new Set<string>();
  for (let index = current.length - 1; index >= 0; index--) {
    if (!wanted.has(current[index]) || seen.has(current[index])) order.delete(index, 1);
    seen.add(current[index]);
  }
  for (let index = 0; index < keys.length; index++) {
    if (order.get(index) === keys[index]) continue;
    const previous = order.toArray().indexOf(keys[index], index);
    if (previous >= 0) order.delete(previous, 1);
    order.insert(index, [keys[index]]);
  }
};

/** Compare at each depth so a save changes only the fields the caller changed. */
export const writeValue = (parent: Y.Map<unknown>, key: string, next: Json, path: string, author?: DocumentAuthor) => {
  const write = () => writeValueContent(parent, key, next, path, author);
  if (author) author(path, key, next, write);
  else write();
};
const writeValueContent = (parent: Y.Map<unknown>, key: string, next: Json, path: string, author?: DocumentAuthor) => {
  const current = parent.get(key) as Json | ValueReference | undefined;
  const document = parent.doc!;
  if (Array.isArray(next)) {
    const reference = valueReference(parent, key, "list", path);
    writeList(document, reference.name, next, author);
  } else if (next !== null && typeof next === "object") {
    const reference = valueReference(parent, key, "object", path);
    const map = document.getMap(reference.name);
    for (const field of map.keys()) if (!Object.hasOwn(next, field)) map.delete(field);
    for (const [field, value] of Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
      writeValue(map, field, value, reference.name, author);
  } else if (
    typeof next === "string" &&
    (next.includes("\n") || (current && typeof current === "object" && "kind" in current && current.kind === "text"))
  ) {
    const reference = valueReference(parent, key, "text", path);
    if (typeof current === "string") seedText(document, reference.name, current);
    writeText(document.getText(reference.name), next);
  } else if (current !== next) parent.set(key, next);
};

const seedText = (document: Y.Doc, name: string, value: string) => {
  // Promotion must give both devices the same original characters before either edits them.
  const client = documentAuthorId(canonicalJson(["text-promotion", name, value]));
  if (Y.decodeStateVector(Y.encodeStateVector(document)).has(client)) return;
  const author = document.clientID;
  document.clientID = client;
  try {
    document.getText(name).insert(0, value);
  } finally {
    document.clientID = author;
  }
};
