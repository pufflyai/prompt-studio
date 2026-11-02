import * as Y from "yjs";
import { textDocumentKeys } from "./text-document-keys";
import { writeText } from "./write-text";

const ownDeletesKey = textDocumentKeys.ownDeletes;
const authorsKey = textDocumentKeys.authors;
type DeleteRange = [client: number, clock: number, length: number];

const rememberRanges = (document: Y.Doc, ranges: DeleteRange[]) => {
  const map = document.getMap<DeleteRange>(ownDeletesKey);
  document.transact(() => {
    for (const [client, clock, length] of ranges) {
      const key = `${client}:${clock}:${length}`;
      if (!map.has(key)) map.set(key, [client, clock, length]);
    }
  });
};

const insertionAuthors = (document: Y.Doc) => {
  const authors = new Map<number, number>();
  for (const value of document.getMap<[number, number]>(authorsKey).values()) {
    if (!Array.isArray(value) || value.length !== 2 || !value.every((item) => Number.isSafeInteger(item) && item >= 0))
      throw new Error("Invalid text insertion author");
    authors.set(value[0], Math.min(authors.get(value[0]) ?? Number.MAX_SAFE_INTEGER, value[1]));
  }
  return authors;
};

export const ownTextInsertions = (document: Y.Doc) => {
  const authors = insertionAuthors(document);
  return (id: Y.ID) => (authors.get(id.client) ?? Number.POSITIVE_INFINITY) <= id.clock;
};

const recordInsertionAuthors = (document: Y.Doc, update: Uint8Array) => {
  const known = insertionAuthors(document);
  const map = document.getMap<[number, number]>(authorsKey);
  document.transact(() => {
    for (const item of Y.decodeUpdate(update).structs) {
      if (!(item instanceof Y.Item) || !(item.content instanceof Y.ContentString)) continue;
      const { client, clock } = item.id;
      if ((known.get(client) ?? Number.POSITIVE_INFINITY) <= clock) continue;
      map.set(`${client}:${clock}`, [client, clock]);
      known.set(client, clock);
    }
  });
};

/** Local editor deltas carry intent; heuristic source alignment never invents deletion origins. */
export const recordTextDeletionIntent = (document: Y.Doc, update: Uint8Array) => {
  const ranges: DeleteRange[] = [];
  for (const [client, entries] of Y.decodeUpdate(update).ds.clients)
    for (const { clock, len } of entries) ranges.push([client, clock, len]);
  rememberRanges(document, ranges);
};

/** Exact inserted-character aliases share one deletion; heuristic genesis matches do not. */
export const rememberExactTextDeletions = (document: Y.Doc, ids: Y.ID[]) => {
  const ordered = [...ids].sort((left, right) => left.client - right.client || left.clock - right.clock);
  const ranges: DeleteRange[] = [];
  for (const id of ordered) {
    const previous = ranges.at(-1);
    if (previous && previous[0] === id.client && id.clock <= previous[1] + previous[2])
      previous[2] = Math.max(previous[2], id.clock - previous[1] + 1);
    else ranges.push([id.client, id.clock, 1]);
  }
  rememberRanges(document, ranges);
};

export const editTextDocument = (document: Y.Doc, edit: (text: Y.Text) => void) => {
  const updates: Uint8Array[] = [];
  const capture = (update: Uint8Array) => updates.push(update);
  document.on("update", capture);
  try {
    document.transact(() => edit(document.getText("content")));
  } finally {
    document.off("update", capture);
  }
  for (const update of updates) {
    recordInsertionAuthors(document, update);
    recordTextDeletionIntent(document, update);
  }
};

export const saveTextDocument = (document: Y.Doc, source: string) =>
  editTextDocument(document, (text) => writeText(text, source));

/** Editor frames are applied to their durable room replica; retries retain their original intent. */
export const applyTextEditorUpdate = (document: Y.Doc, update: Uint8Array) =>
  editTextDocument(document, () => Y.applyUpdate(document, update));

export const ownTextDeletions = (document: Y.Doc) => {
  const ranges = new Map<number, Array<{ start: number; end: number }>>();
  for (const value of document.getMap<DeleteRange>(ownDeletesKey).values()) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every((item) => Number.isSafeInteger(item) && item >= 0))
      throw new Error("Invalid text deletion origin");
    const [client, clock, length] = value;
    if (!length || !Number.isSafeInteger(clock + length)) throw new Error("Invalid text deletion range");
    const entries = ranges.get(client) ?? [];
    entries.push({ start: clock, end: clock + length });
    ranges.set(client, entries);
  }
  for (const [client, entries] of ranges) {
    entries.sort((left, right) => left.start - right.start);
    const merged: typeof entries = [];
    for (const entry of entries) {
      const previous = merged.at(-1);
      if (previous && entry.start <= previous.end) previous.end = Math.max(previous.end, entry.end);
      else merged.push({ ...entry });
    }
    ranges.set(client, merged);
  }
  return (id: Y.ID) => {
    const entries = ranges.get(id.client) ?? [];
    let left = 0;
    let right = entries.length - 1;
    while (left <= right) {
      const middle = Math.floor((left + right) / 2);
      const range = entries[middle]!;
      if (id.clock < range.start) right = middle - 1;
      else if (id.clock >= range.end) left = middle + 1;
      else return true;
    }
    return false;
  };
};
