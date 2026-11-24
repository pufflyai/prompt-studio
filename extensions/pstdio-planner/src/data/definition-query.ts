import type { ExtensionStorageApi, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";
import type { StoredStatus, StoredTag } from "./types";

export const definitionIndexes: StorageRecordIndex[] = ["ticket-statuses", "ticket-tags"].map((collection) => ({
  name: `definitions:${collection}`,
  collection,
  fields: { body: { path: [], type: "object" } },
}));
export const legacyCleanupIndexes: StorageRecordIndex[] = [
  "workspace-status-definitions",
  "workspace-status-values",
].map((collection) => ({
  name: `cleanup:${collection}`,
  collection,
  fields: { key: { path: ["unused"], type: "string" } },
}));

// View schemas have an explicit bound; silently dropping definitions would corrupt filters and edits.
const readDefinitions = async <T>(storage: ExtensionStorageApi, collection: string) => {
  await preparePlannerIndexes(storage);
  const page = await storage.records.query({ index: `definitions:${collection}`, fields: ["body"], limit: 500 });
  if (page.cursor) throw new Error("Planner supports at most 500 property definitions in one schema");
  return page.records.map(({ fields }) => fields.body as unknown as T);
};
export const readStatusDefinitions = (storage: ExtensionStorageApi) =>
  readDefinitions<StoredStatus>(storage, "ticket-statuses");
export const readTagDefinitions = (storage: ExtensionStorageApi) => readDefinitions<StoredTag>(storage, "ticket-tags");
