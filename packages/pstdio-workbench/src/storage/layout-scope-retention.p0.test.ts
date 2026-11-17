import { expect, test } from "bun:test";
import { createDefaultWorkbenchLayout } from "../core";
import { mainScope } from "../core/controllers/page-runtime/page-main-scope";
import { createLocalStorageLayoutPersistence } from "./local-storage-layout-persistence";
import { workbenchStoragePersistenceKey } from "./local-storage-persistence-helpers";

const createStore = () => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};

test("canonical page and mode scopes participate in project transforms and the existing resource bound", () => {
  const storage = createStore();
  const persistence = createLocalStorageLayoutPersistence({ namespace: "canonical", storage, debounceMs: 0 });
  const layout = createDefaultWorkbenchLayout();
  const scope = (id?: string) =>
    mainScope(
      { projectId: "one", modeId: "edit", pageId: "notes", resource: id ? { type: "note", id } : undefined },
      undefined,
    );
  const aggregate = scope();
  const mode = 'workbench-mode:["one","edit"]';
  const other = mainScope({ projectId: "two", modeId: "edit", pageId: "notes" }, undefined);
  try {
    persistence.setLayout(layout, aggregate);
    persistence.setLayout(layout, mode);
    persistence.setLayout(layout, other);
    for (let index = 0; index < 51; index++) persistence.setLayout(layout, scope(String(index)));
    expect(persistence.getLayout(scope("0"))).toBeUndefined();
    expect(persistence.getLayout(scope("50"))).toEqual(layout);
    expect(persistence.getLayout(aggregate)).toEqual(layout);
    expect(persistence.listScopes?.("one")).toHaveLength(52);
    persistence.transformLayouts?.("one", () => undefined);
    expect(persistence.listScopes?.("one")).toEqual([]);
    expect(persistence.getLayout(other)).toEqual(layout);
  } finally {
    persistence.dispose?.();
  }
});

test("canonical resource layouts written before indexing are bounded when the owner next writes", () => {
  const storage = createStore();
  const layout = createDefaultWorkbenchLayout();
  const scope = (index: number) =>
    mainScope(
      { projectId: "one", modeId: "edit", pageId: "notes", resource: { type: "note", id: String(index) } },
      undefined,
    );
  for (let index = 0; index < 55; index++)
    storage.setItem(
      workbenchStoragePersistenceKey("canonical", "layout", scope(index)),
      JSON.stringify({ version: 5, layout }),
    );
  storage.setItem(
    workbenchStoragePersistenceKey("canonical", "layout-resource-index", "one"),
    JSON.stringify({ version: 1, scopes: [] }),
  );
  const persistence = createLocalStorageLayoutPersistence({ namespace: "canonical", storage, debounceMs: 0 });
  try {
    persistence.setLayout(layout, scope(55));
    expect(persistence.listScopes?.("one")).toHaveLength(50);
    expect(persistence.getLayout(scope(0))).toBeUndefined();
    expect(persistence.getLayout(scope(55))).toEqual(layout);
  } finally {
    persistence.dispose?.();
  }
});

test("a disposed layout adapter cannot resume writes or change saved layouts", () => {
  const storage = createStore();
  const persistence = createLocalStorageLayoutPersistence({ namespace: "closed", storage, debounceMs: 0 });
  const layout = createDefaultWorkbenchLayout();
  persistence.setLayout(layout, "project/one");
  persistence.dispose?.();
  persistence.setLayout({ ...layout, activeWidgetId: "late" }, "project/one");
  persistence.transformLayouts?.("one", () => undefined);
  expect(persistence.getLayout("project/one")).toEqual(layout);
});

test("a failed layout flush retires the adapter and releases its pagehide listener", () => {
  const saved = createStore();
  let quota = true;
  const storage = {
    ...saved,
    setItem(key: string, value: string) {
      if (quota) throw new Error("quota exceeded");
      saved.setItem(key, value);
    },
  };
  const listeners = new Set<() => void>();
  const persistence = createLocalStorageLayoutPersistence({
    namespace: "failed",
    storage,
    eventTarget: {
      addEventListener: (_type, listener) => void listeners.add(listener),
      removeEventListener: (_type, listener) => void listeners.delete(listener),
    },
  });
  const layout = createDefaultWorkbenchLayout();
  persistence.setLayout(layout, "project/one");
  expect(() => persistence.dispose?.()).toThrow("quota exceeded");
  expect(listeners.size).toBe(0);
  quota = false;
  persistence.setLayout({ ...layout, activeWidgetId: "late" }, "project/one");
  persistence.flush?.();
  expect(persistence.getLayout("project/one")).toBeUndefined();
});
