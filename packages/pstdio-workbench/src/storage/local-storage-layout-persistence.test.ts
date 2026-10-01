import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../core";
import { createLocalStorageLayoutPersistence } from "./local-storage-layout-persistence";

test("persists layouts and their scope before returning when debouncing is disabled", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage, debounceMs: 0 });
  const scope = "project/one/mode/default/page/sessions";
  const layout = createDefaultWorkbenchLayout();
  try {
    persistence.setLayout(layout, scope);

    expect(JSON.parse(storage.getItem(`demo:layout:${scope}`) ?? "null")).toEqual({ version: 5, layout });
    expect(persistence.listScopes?.("one")).toEqual([scope]);
  } finally {
    persistence.dispose?.();
  }
});
