import type { ExtensionStorageApi, WebviewEditingChange } from "@pstdio/sdk/extensions";
import { migrateScribblePageRecords } from "./scribble-pages-migration";
import { exampleNames } from "./state-defaults";

export const exampleRecordId = (storage: ExtensionStorageApi, name: string) => storage.records.id(`example:${name}`);
export const storedChangeField = (key: string) => `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const migrateExampleStorage = (storage: ExtensionStorageApi) =>
  storage.migrate(3, async (previous, migration) => {
    if (previous < 1) await migrateScribblePageRecords(storage, migration);
    const collections = await Promise.all(
      exampleNames
        .filter((name) => name !== "scribble")
        .map(async (name) => ({
          name,
          changes: await storage.collection<WebviewEditingChange>(`examples:${name}`).list(),
          copied: (await storage.records.read(exampleRecordId(storage, name))).exists,
        })),
    );
    for (const { name, changes, copied } of collections)
      if (changes.length && !copied)
        await storage.records.commit({
          operationId: migration.id(`example-record:${name}`),
          edits: [
            {
              recordId: exampleRecordId(storage, name),
              replace: Object.fromEntries(changes.map(({ path, value }) => [JSON.stringify(path), { path, value }])),
            },
          ],
        });
    for (const record of await storage.records.list()) {
      if (record.shared?.kind !== "map" || record.value !== null) continue;
      await storage.records.commit({
        operationId: migration.id(`plain-record:${record.recordId}`),
        edits: [{ recordId: record.recordId, replace: record.shared.value }],
      });
    }
    for (const { name, changes } of collections)
      for (const { path } of changes) await storage.collection(`examples:${name}`).delete(JSON.stringify(path));
  });

export const readExampleChanges = async (storage: ExtensionStorageApi, name: string) => {
  const record = await storage.records.read(exampleRecordId(storage, name));
  return Object.values(objectValue(record.value)) as WebviewEditingChange[];
};
