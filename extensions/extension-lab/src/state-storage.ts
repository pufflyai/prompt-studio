import type { ExtensionStorageApi, SharedStorageEdit, WebviewEditingChange } from "@pstdio/sdk/extensions";
import { exampleNames } from "./state-defaults";

export const exampleRecordId = (storage: ExtensionStorageApi, name: string) => storage.records.id(`example:${name}`);

export const migrateExampleStorage = (storage: ExtensionStorageApi) =>
  storage.migrate(1, async () => {
    const collections = await Promise.all(
      exampleNames.map(async (name) => ({
        name,
        changes: await storage.collection<WebviewEditingChange>(`examples:${name}`).list(),
        copied: (await storage.records.read(exampleRecordId(storage, name))).exists,
      })),
    );
    const edits = collections
      .filter(({ changes, copied }) => changes.length && !copied)
      .map(({ name, changes }) => ({
        recordId: exampleRecordId(storage, name),
        shared: changes.map(
          ({ path, value }) =>
            ({ kind: "map.set", key: JSON.stringify(path), value: { path, value } }) satisfies SharedStorageEdit,
        ),
      }));
    if (edits.length) await storage.records.commit({ operationId: storage.ids.create(), edits });
    for (const { name, changes } of collections)
      for (const { path } of changes) await storage.collection(`examples:${name}`).delete(JSON.stringify(path));
  });

export const readExampleChanges = async (storage: ExtensionStorageApi, name: string) => {
  const record = await storage.records.read(exampleRecordId(storage, name));
  return record.shared?.kind === "map" ? (Object.values(record.shared.value) as unknown as WebviewEditingChange[]) : [];
};
