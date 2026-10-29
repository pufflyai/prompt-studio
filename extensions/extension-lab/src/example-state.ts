import {
  applyEditingChanges,
  type ExtensionStorageApi,
  rebaseEditingChanges,
  type SharedStorageEdit,
  type WebviewEditingChange,
} from "@pstdio/sdk/extensions";
import { readScribbleState, writeScribbleState } from "./scribble-pages-storage";
import { type ExampleName, exampleDefaults } from "./state-defaults";
import { exampleRecordId, migrateExampleStorage, readExampleChanges } from "./state-storage";

export const readExampleState = async <Name extends ExampleName>(storage: ExtensionStorageApi, name: Name) => {
  if (name === "scribble") return Object.assign({}, exampleDefaults[name], await readScribbleState(storage));
  await migrateExampleStorage(storage);
  const changes = await readExampleChanges(storage, name);
  changes.sort((a, b) => a.path.length - b.path.length);
  const drafts = new Map(changes.map((change) => [JSON.stringify(change.path), [change]]));
  return rebaseEditingChanges(exampleDefaults[name], drafts).value;
};

export const writeExampleState = async (
  storage: ExtensionStorageApi,
  name: ExampleName,
  changes: WebviewEditingChange[],
) => {
  if (name === "scribble") return writeScribbleState(storage, changes);
  applyEditingChanges(await readExampleState(storage, name), changes);
  const stored = new Map(
    (await readExampleChanges(storage, name)).map((change) => [JSON.stringify(change.path), change]),
  );
  const shared: SharedStorageEdit[] = [];
  for (const change of changes) {
    for (const [key, previous] of stored) {
      if (
        previous.path.length > change.path.length &&
        change.path.every((part, index) => part === previous.path[index])
      ) {
        shared.push({ kind: "map.delete", key });
        stored.delete(key);
      }
    }
    const key = JSON.stringify(change.path);
    shared.push({ kind: "map.set", key, value: { path: change.path, value: change.value } });
    stored.set(key, change);
  }
  if (shared.length)
    await storage.records.commit({
      operationId: storage.ids.create(),
      edits: [{ recordId: exampleRecordId(storage, name), shared }],
    });
  return readExampleState(storage, name);
};
