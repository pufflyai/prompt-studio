import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../core";
import {
  modeLayoutScope,
  pageGeometryScope,
  pageLayoutScope,
} from "../core/controllers/page-runtime/owner-layout-scope";
import { createLocalStorageLayoutPersistence } from "./local-storage-layout-persistence";

test("owner layouts can be listed and removed through their project index", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const persistence = createLocalStorageLayoutPersistence({ namespace: "owner", storage, debounceMs: 0 });
  const scopes = [
    pageLayoutScope({ projectId: "one", pageId: "workspace", resource: { type: "workspace", id: "alpha" } })!,
    modeLayoutScope("one", "edit"),
    pageGeometryScope("one", "workspace"),
  ];
  for (const scope of scopes) persistence.setLayout(createDefaultWorkbenchLayout(), scope);
  expect(persistence.listScopes?.("one")).toEqual(scopes);
  persistence.transformLayouts?.("one", () => undefined);
  for (const scope of scopes) expect(persistence.getLayout(scope)).toBeUndefined();
  persistence.dispose?.();
});

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

    expect(JSON.parse(storage.getItem(`demo:layout:${scope}`) ?? "null")).toEqual({ version: 6, layout });
    expect(persistence.listScopes?.("one")).toEqual([scope]);
  } finally {
    persistence.dispose?.();
  }
});
