import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readScribbleState, writeScribbleState } from "./scribble-pages-storage";
import { applyStateChanges, type StateChange } from "./state-changes";
import { type ExampleName, exampleDefaults } from "./state-defaults";

const readStoredExampleState = async <Name extends ExampleName>(storage: ExtensionStorageApi, name: Name) => {
  const changes = await storage.collection<StateChange>(`examples:${name}`).list();
  changes.sort((a, b) => a.path.length - b.path.length);
  return applyStateChanges(exampleDefaults[name], changes);
};

export const readExampleState = async <Name extends ExampleName>(storage: ExtensionStorageApi, name: Name) => {
  if (name === "scribble") return Object.assign({}, exampleDefaults[name], await readScribbleState(storage));
  return readStoredExampleState(storage, name);
};

export const writeExampleState = async (storage: ExtensionStorageApi, name: ExampleName, changes: StateChange[]) => {
  if (name === "scribble") return writeScribbleState(storage, changes);
  applyStateChanges(exampleDefaults[name], changes);
  const collection = storage.collection<StateChange>(`examples:${name}`);
  // Each field owns its stored value, so simultaneous edits in separate views cannot overwrite each other.
  for (const change of changes) await collection.put(JSON.stringify(change.path), change);
  return readExampleState(storage, name);
};
