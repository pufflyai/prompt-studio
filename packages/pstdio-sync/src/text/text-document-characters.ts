import diff from "fast-diff";
import * as Y from "yjs";
import { ownTextDeletions } from "./text-document-edits";

export const characterKey = (id: Y.ID) => `${id.client}:${id.clock}`;
export const characterId = (key: string) => {
  const [client, clock] = key.split(":").map(Number);
  return Y.createID(client!, clock!);
};
export type CharacterMapping = Map<string, Y.ID | null>;

export const validateTextCharacterRange = (document: Y.Doc, client: number, start: number, length: number) => {
  const text = document.getText("content");
  const end = start + length;
  for (let clock = start; clock < end; ) {
    const item = Y.getItem(document.store, Y.createID(client, clock));
    if (
      !(item instanceof Y.Item) ||
      item.parent !== text ||
      !(item.content instanceof Y.ContentString || item.content instanceof Y.ContentDeleted)
    )
      throw new Error("Text mappings must refer to content characters");
    clock = Math.min(end, item.id.clock + item.length);
  }
};

export const textCharacters = (text: Y.Text) => {
  const value = text.toString();
  return Array.from({ length: text.length }, (_, index) => ({
    id: Y.createRelativePositionFromTypeIndex(text, index).item!,
    value: value[index]!,
  }));
};

export const visibleCharacter = (text: Y.Text, id: Y.ID) => {
  const relative = new Y.RelativePosition(null, "content", id, 0);
  const absolute = Y.createAbsolutePositionFromRelativePosition(relative, text.doc!);
  if (!absolute || absolute.type !== text) return undefined;
  const current = Y.createRelativePositionFromTypeIndex(text, absolute.index).item;
  if (current?.client !== id.client || current?.clock !== id.clock) return undefined;
  return absolute.index;
};

export const isDeletedCharacter = (text: Y.Text, id: Y.ID) => {
  const vector = Y.decodeStateVector(Y.encodeStateVector(text.doc!));
  return (vector.get(id.client) ?? 0) > id.clock && visibleCharacter(text, id) === undefined;
};

export const mapOriginalCharacters = (source: Y.Text, target: Y.Text) => {
  const left = textCharacters(source);
  const right = textCharacters(target);
  const mapping: CharacterMapping = new Map(left.map(({ id }) => [characterKey(id), null]));
  let sourceIndex = 0;
  let targetIndex = 0;
  for (const [operation, value] of diff(source.toString(), target.toString())) {
    if (operation === diff.EQUAL)
      for (let offset = 0; offset < value.length; offset++)
        mapping.set(characterKey(left[sourceIndex + offset]!.id), right[targetIndex + offset]!.id);
    if (operation !== diff.INSERT) sourceIndex += value.length;
    if (operation !== diff.DELETE) targetIndex += value.length;
  }
  return mapping;
};

const insertionIndex = (
  characters: ReturnType<typeof textCharacters>,
  start: number,
  mapping: CharacterMapping,
  target: Y.Text,
) => {
  for (let index = start; index < characters.length; index++) {
    const id = mapping.get(characterKey(characters[index]!.id));
    if (!id) continue;
    const position = Y.createAbsolutePositionFromRelativePosition(
      new Y.RelativePosition(null, "content", id, 0),
      target.doc!,
    );
    if (position?.type === target) return position.index;
  }
  return target.length;
};

/** Preserve a known deletion as a canonical CRDT anchor when composing retired roots. */
export const mapDeletedCharacter = (source: Y.Text, target: Y.Text, mapping: CharacterMapping, id: Y.ID) => {
  const key = characterKey(id);
  const known = mapping.get(key);
  if (known !== undefined) return known;
  const vector = Y.decodeStateVector(Y.encodeStateVector(source.doc!));
  if ((vector.get(id.client) ?? 0) <= id.clock || visibleCharacter(source, id) !== undefined) return undefined;
  const absolute = Y.createAbsolutePositionFromRelativePosition(
    new Y.RelativePosition(null, "content", id, 0),
    source.doc!,
  );
  const position = insertionIndex(textCharacters(source), absolute?.index ?? source.length, mapping, target);
  target.insert(position, " ");
  const anchor = Y.createRelativePositionFromTypeIndex(target, position).item!;
  target.delete(position, 1);
  mapping.set(key, anchor);
  return anchor;
};

/** Translate source identities once; canonical insertions never enter the source mapping. */
export const translateCharacters = (
  source: Y.Text,
  target: Y.Text,
  mapping: CharacterMapping,
  genesis: Map<number, number>,
) => {
  const characters = textCharacters(source);
  const visible = new Set(characters.map(({ id }) => characterKey(id)));
  const vector = Y.decodeStateVector(Y.encodeStateVector(source.doc!));
  const ownDeletion = ownTextDeletions(source.doc!);
  const deletions = new Set<number>();
  const exactDeletes: Y.ID[] = [];
  for (const [key, id] of mapping) {
    const original = characterId(key);
    if (!id || visible.has(key) || !ownDeletion(original) || (vector.get(original.client) ?? 0) <= original.clock)
      continue;
    if ((genesis.get(original.client) ?? 0) <= original.clock) exactDeletes.push(id);
    const index = visibleCharacter(target, id);
    if (index !== undefined) deletions.add(index);
  }
  for (const index of [...deletions].sort((left, right) => right - left)) target.delete(index, 1);
  for (let index = 0; index < characters.length; ) {
    if (mapping.has(characterKey(characters[index]!.id))) {
      index++;
      continue;
    }
    const start = index;
    while (index < characters.length && !mapping.has(characterKey(characters[index]!.id))) index++;
    const position = insertionIndex(characters, index, mapping, target);
    target.insert(
      position,
      characters
        .slice(start, index)
        .map(({ value }) => value)
        .join(""),
    );
    for (let offset = start; offset < index; offset++)
      mapping.set(
        characterKey(characters[offset]!.id),
        Y.createRelativePositionFromTypeIndex(target, position + offset - start).item!,
      );
  }
  return exactDeletes;
};
