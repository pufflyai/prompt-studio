import type { ExtensionStorageApi, JsonObject } from "@pstdio/sdk/extensions";
import type { ScribbleDocument } from "./apps/scribble-data";
import { scribblePageEdit, scribblePageFields } from "./scribble-page-record";
import { migrateScribblePages } from "./scribble-pages-migration";
import { createScribbleDocument } from "./scribble-pages-state";
import { applyStateChanges, type StateChange } from "./state-changes";
import { documentMarkdown, exampleDefaults } from "./state-defaults";

const seedEntry = (document: ScribbleDocument, index: number) => ({
  document,
  position: `${(index + 1).toString(16).padStart(8, "0")}1`,
  content: documentMarkdown(document),
  favorite: exampleDefaults.scribble.favoriteIds.includes(document.id),
});

export const readScribblePageEntries = async (storage: ExtensionStorageApi) => {
  await migrateScribblePages(storage);
  const entries = new Map(
    exampleDefaults.scribble.documents.map((document, index) => [document.id, seedEntry(document, index)]),
  );
  for (const record of await storage.records.list()) {
    if (record.deleted || record.shared?.kind !== "map" || record.shared.value.kind !== "scribble.page") continue;
    const { id, kind: _kind, position, content, favorite, ...fields } = record.shared.value;
    const pageId = id as string;
    const seed =
      entries.get(pageId) ??
      seedEntry(createScribbleDocument(exampleDefaults.scribble, pageId).documents.at(-1)!, entries.size);
    entries.set(pageId, {
      document: { ...seed.document, ...fields } as ScribbleDocument,
      position: (position as string | undefined) ?? seed.position,
      content: (content as string | undefined) ?? seed.content,
      favorite: (favorite as boolean | undefined) ?? seed.favorite,
    });
  }
  return [...entries.values()].sort((a, b) => (a.position < b.position ? -1 : 1));
};

export const updateScribblePageFields = async (storage: ExtensionStorageApi, id: string, fields: JsonObject) => {
  await migrateScribblePages(storage);
  await storage.records.commit({ operationId: crypto.randomUUID(), edits: [scribblePageEdit(storage, id, fields)] });
};

export const readScribbleState = async (storage: ExtensionStorageApi) => {
  const entries = await readScribblePageEntries(storage);
  return {
    documents: entries.map((entry) => entry.document),
    favoriteIds: entries.filter((entry) => entry.favorite).map((entry) => entry.document.id),
    contentById: Object.fromEntries(entries.map((entry) => [entry.document.id, entry.content])),
  };
};

export const saveScribblePage = async (
  storage: ExtensionStorageApi,
  id: string,
  title: string,
  icon: string,
  content: string,
) => {
  const entries = await readScribblePageEntries(storage);
  const existing = entries.find((entry) => entry.document.id === id);
  if (existing) return updateScribblePageFields(storage, id, { title, icon, content });
  const document = { ...createScribbleDocument(exampleDefaults.scribble, id).documents.at(-1)!, title, icon };
  await updateScribblePageFields(
    storage,
    id,
    scribblePageFields(document, storage.positions.between(entries.at(-1)?.position), content, false),
  );
};

export const writeScribbleState = async (storage: ExtensionStorageApi, changes: StateChange[]) => {
  const before = await readScribbleState(storage);
  const after = applyStateChanges(before, changes);
  const edits = before.documents.flatMap(({ id }) => {
    const fields: JsonObject = {};
    if (before.contentById[id] !== after.contentById[id]) fields.content = after.contentById[id] ?? "";
    if (before.favoriteIds.includes(id) !== after.favoriteIds.includes(id))
      fields.favorite = after.favoriteIds.includes(id);
    return Object.keys(fields).length ? [scribblePageEdit(storage, id, fields)] : [];
  });
  if (edits.length) await storage.records.commit({ operationId: crypto.randomUUID(), edits });
  return readScribbleState(storage);
};
