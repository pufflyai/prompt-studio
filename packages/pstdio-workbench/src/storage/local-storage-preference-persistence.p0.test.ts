import { expect, test } from "bun:test";
import { createWorkbench } from "../core";
import { createLocalStorageWorkbenchPersistence } from "./local-storage-persistence";
import { createLocalStoragePreferencePersistence } from "./local-storage-preference-persistence";
import type { PreferenceStorageEvents } from "./preference-storage-observation";

const setup = () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  return { values, storage, create: () => createLocalStoragePreferencePersistence(storage, "preferences") };
};

test("preferences observe other adapters and preserve their writes", () => {
  const { create } = setup();
  const first = create();
  const second = create();
  const scope = { scope: "user" } as const;
  expect(first.getValue("enabled", scope)).toBeUndefined();
  second.setValue("enabled", false, scope);
  expect(first.getValue("enabled", scope)).toBe(false);
  first.setValue("size", 2, scope);
  expect(second.getValue("enabled", scope)).toBe(false);
  expect(second.getValue("size", scope)).toBe(2);
  second.setValue("size", 3, scope);
  expect(first.getValue("size", scope)).toBe(3);
});

test("preferences recover after external replacement, removal, or invalid data", () => {
  const { create, values } = setup();
  const adapter = create();
  const scope = { scope: "user" } as const;
  adapter.setValue("size", 1, scope);
  expect(adapter.getValue("size", scope)).toBe(1);
  values.set("preferences", "invalid");
  expect(adapter.getValue("size", scope)).toBeUndefined();
  values.set("preferences", JSON.stringify({ [JSON.stringify(["size", "user", null])]: 2 }));
  expect(adapter.getValue("size", scope)).toBe(2);
  values.delete("preferences");
  expect(adapter.getValue("size", scope)).toBeUndefined();
  adapter.setValue("size", 3, scope);
  expect(adapter.getValue("size", scope)).toBe(3);
});

test("mutating preference inputs or results does not change persisted values", () => {
  const { create } = setup();
  const adapter = create();
  const scope = { scope: "user" } as const;
  const input = { nested: { items: ["original"] } };
  adapter.setValue("object", input, scope);
  input.nested.items.push("unsaved input");
  const result = adapter.getValue("object", scope) as typeof input;
  result.nested.items.push("unsaved result");
  adapter.setValue("other", true, scope);
  expect(adapter.getValue("object", scope)).toEqual({ nested: { items: ["original"] } });
  adapter.setValue("array", [1, 2], scope);
  (adapter.getValue("array", scope) as number[]).push(3);
  expect(adapter.getValue("array", scope)).toEqual([1, 2]);
});

test("user preferences keep an explicit false value across workbench reloads", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const create = () => {
    const workbench = createWorkbench(createLocalStorageWorkbenchPersistence({ namespace: "test", storage }));
    workbench.preferences.registerSchema({
      properties: { related: { type: "boolean", scope: "user", default: true } },
    });
    return workbench;
  };
  const first = create();
  expect(first.preferences.getValue("related")).toBe(true);
  await first.preferences.setValue("related", false, { scope: "user" });
  expect(create().preferences.getValue("related")).toBe(false);
});

test("window preference changes and storage clear reach observers through one released event source", async () => {
  const { storage, values } = setup();
  const listeners = new Set<Parameters<PreferenceStorageEvents["addEventListener"]>[1]>();
  const events: PreferenceStorageEvents = {
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
  };
  const create = () =>
    createWorkbench({ preferencePersistence: createLocalStoragePreferencePersistence(storage, "preferences", events) });
  const first = create();
  const second = create();
  const accepted: string[] = [];
  first.preferences.registerSchema({ properties: { size: { type: "number", scope: "user", default: 0 } } });
  first.preferences.onDidChangeValue((name) => {
    if (name === "size") accepted.push(`${name}:${first.preferences.getValue(name)}`);
  });
  expect(listeners.size).toBe(1);
  const newValue = JSON.stringify({ [JSON.stringify(["size", "user", null])]: 2 });
  values.set("preferences", newValue);
  for (const listener of listeners) listener({ key: "preferences", oldValue: null, newValue, storageArea: null });
  values.clear();
  for (const listener of listeners) listener({ key: null, oldValue: null, newValue: null, storageArea: null });
  expect(accepted).toEqual(["size:2", "size:0"]);
  await first.dispose();
  expect(listeners.size).toBe(1);
  await second.dispose();
  expect(listeners.size).toBe(0);
});
