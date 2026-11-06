import {
  applyEditingChanges,
  type ExtensionStorageApi,
  rebaseEditingChanges,
  type WebviewEditingChange,
} from "@pstdio/sdk/extensions";
import { readScribbleState, writeScribbleState } from "./scribble-pages-storage";
import { type ExampleName, exampleDefaults } from "./state-defaults";
import { exampleRecordId, migrateExampleStorage, readExampleChanges, storedChangeField } from "./state-storage";

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
  const set: Record<string, import("@pstdio/sdk/extensions").JsonValue> = {};
  const unset = new Set<string>();
  for (const change of changes) {
    for (const [key, previous] of stored) {
      if (
        previous.path.length > change.path.length &&
        change.path.every((part, index) => part === previous.path[index])
      ) {
        const field = storedChangeField(key);
        delete set[field];
        unset.add(field);
        stored.delete(key);
      }
    }
    const key = JSON.stringify(change.path);
    const field = storedChangeField(key);
    unset.delete(field);
    set[field] = { path: change.path, value: change.value };
    stored.set(key, change);
  }
  if (Object.keys(set).length || unset.size)
    await storage.records.commit({
      operationId: storage.ids.create(),
      edits: [{ recordId: exampleRecordId(storage, name), set, unset: [...unset] }],
    });
  return readExampleState(storage, name);
};
