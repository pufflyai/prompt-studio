import type { ExtensionStorageApi, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";
import type { StoredStatus, StoredTag } from "./types";

export const definitionIndexes: StorageRecordIndex[] = ["ticket-statuses", "ticket-tags"].map((collection) => ({
  name: `definitions:${collection}`,
  collection,
  fields: { body: { path: [], type: "object" } },
}));
const readDefinitions = async <T>(storage: ExtensionStorageApi, collection: string) => {
  await preparePlannerIndexes(storage);
  const rows: T[] = [];
  let cursor: string | undefined;
  let revision: string | undefined;
  do {
    const page = await storage.records.query({
      index: `definitions:${collection}`,
      fields: ["body"],
      limit: 100,
      cursor,
      revision,
    });
    revision = page.revision;
    rows.push(...page.records.map(({ fields }) => fields.body as unknown as T));
    cursor = page.cursor ?? undefined;
  } while (cursor);
  return rows;
};
export const readStatusDefinitions = (storage: ExtensionStorageApi) =>
  readDefinitions<StoredStatus>(storage, "ticket-statuses");
export const readTagDefinitions = (storage: ExtensionStorageApi) => readDefinitions<StoredTag>(storage, "ticket-tags");
