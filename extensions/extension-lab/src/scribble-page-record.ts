import type { ExtensionStorageApi, JsonObject } from "@pstdio/sdk/extensions";
import type { ScribbleDocument } from "./apps/scribble-data";

export const scribblePageFields = (
  document: ScribbleDocument,
  position: string,
  content: string,
  favorite: boolean,
) => ({
  ...document,
  sections: document.sections.map((section) => ({ ...section })),
  tasks: [...document.tasks],
  position,
  content,
  favorite,
});

export const scribblePageEdit = (storage: ExtensionStorageApi, id: string, fields: JsonObject) => ({
  recordId: storage.records.id(`scribble.page:${id}`),
  set: Object.fromEntries(
    Object.entries({ kind: "scribble.page", id, ...fields }).map(([key, value]) => [
      `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
      value,
    ]),
  ),
});
