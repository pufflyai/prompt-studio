import type { ExtensionStorageApi, JsonObject, StorageQueryRecord } from "pstdio-api-contracts/extension-kernel";

/** Read at most 100 collection rows selected by an index, preserving order and missing rows. */
export const readCollectionRecords = async <T>(storage: Pick<ExtensionStorageApi, "records">, recordIds: string[]) =>
  (await storage.records.readMany(recordIds)).map((record) =>
    record.exists && !record.deleted ? (record.value as { value: T }).value : undefined,
  );

/** Patch selected collection fields in one bounded save. Null means the selected revisions changed; query again. */
export const patchCollectionRecords = (
  storage: Pick<ExtensionStorageApi, "records" | "ids">,
  selected: StorageQueryRecord[],
  fields: JsonObject,
) => {
  const set = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [`/value/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, value]),
  );
  return storage.records.commitIfCurrent({
    operationId: storage.ids.create(),
    edits: selected.map(({ recordId, revision }) => ({ recordId, expectedRevision: revision, set })),
  });
};
