import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../core";
import { createLocalStorageLayoutPersistence } from "./local-storage-layout-persistence";
import { createLocalStorageWorkbenchPersistence } from "./local-storage-persistence";

test("enumerates pending and persisted inactive layouts through snapshot persistence", () => {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const first = createLocalStorageWorkbenchPersistence({ namespace: "tabs", storage });
  const layout = createDefaultWorkbenchLayout();
  layout.regions.side.widgets.push({
    widgetId: "session",
    contributionId: "session",
    resource: { type: "session", id: "saved" },
  });
  first.snapshotPersistence.setSnapshot({ layout }, 'workbench-mode:["project","alpha"]');
  expect(first.snapshotPersistence.listLayouts?.().map((entry) => entry.layout)).toEqual([layout]);
  first.snapshotPersistence.dispose?.();
  const reloaded = createLocalStorageWorkbenchPersistence({ namespace: "tabs", storage });
  try {
    expect(reloaded.snapshotPersistence.listLayouts?.().map((entry) => entry.layout)).toEqual([layout]);
    layout.regions.side.widgets = [];
    reloaded.snapshotPersistence.setSnapshot({ layout }, 'workbench-mode:["project","alpha"]');
    expect(reloaded.snapshotPersistence.listLayouts?.()[0].layout.regions.side.widgets).toEqual([]);
  } finally {
    reloaded.snapshotPersistence.dispose?.();
  }
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

    expect(JSON.parse(storage.getItem(`demo:layout:${scope}`) ?? "null")).toEqual({ version: 5, layout });
    expect(persistence.listScopes?.("one")).toEqual([scope]);
  } finally {
    persistence.dispose?.();
  }
});
