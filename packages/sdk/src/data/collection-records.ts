import type { ExtensionStorageApi, JsonObject, StorageQueryRecord } from "pstdio-api-contracts/extension-kernel";

/** Create a bounded batch in a legacy collection without replacing concurrent creations.
 * Address construction stays in the SDK; extensions do not depend on its encoding.
 */
export const createCollectionRecordsIfAbsent = async (
  storage: Pick<ExtensionStorageApi, "records" | "ids">,
  collection: string,
  items: { id: string; value: JsonObject }[],
) => {
  if (!collection || items.length > 100 || new Set(items.map(({ id }) => id)).size !== items.length)
    throw new Error("Create at most 100 distinct collection records per batch");
  if (!items.length) return;
  items = structuredClone(items);
  const ids = items.map(({ id }) => {
    const address = JSON.parse(storage.records.id(id)) as string[];
    if (address.at(-2) !== "kv") throw new Error("Collection creation requires a scoped storage address");
    return JSON.stringify([...address.slice(0, -2), "collection", collection, id]);
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await storage.records.readMany(ids);
    const edits = current.flatMap((record, i) =>
      record.exists && !record.deleted
        ? []
        : [
            {
              recordId: ids[i],
              expectedRevision: record.revision,
              deleted: false,
              replace: { value: items[i].value, sortOrder: null },
            },
          ],
    );
    if (!edits.length) return;
    const saved = await storage.records.commit({ operationId: storage.ids.create(), edits });
    if (saved.state !== "refused") return saved;
  }
  throw new Error("Collection creation changed concurrently; retry the selected batch");
};

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
