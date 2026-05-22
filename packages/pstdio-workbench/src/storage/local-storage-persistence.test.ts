import { describe, expect, test } from "bun:test";
import { createDefaultWorkbenchLayout, type PersistedWorkbenchPanels } from "../core";
import {
  createLocalStorageLayoutPersistence,
  createLocalStoragePanelsPersistence,
  type WorkbenchStorageLike,
  workbenchStoragePersistenceKey,
} from "./local-storage-persistence";

const createStore = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe("local storage workbench persistence", () => {
  test("persists layout state by namespace and scope", () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });
    const layout = createDefaultWorkbenchLayout();

    persistence.setLayout(layout, "project:one");

    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "layout", "project:one"))).toBe(
      JSON.stringify(layout),
    );
    expect(persistence.getLayout("project:one")).toEqual(layout);
    expect(persistence.getLayout("project:two")).toBeUndefined();
  });

  test("persists panel state by namespace and scope", () => {
    const storage = createStore();
    const persistence = createLocalStoragePanelsPersistence({
      namespace: "demo",
      scope: "project:one",
      storage,
    });
    const panels: PersistedWorkbenchPanels = { openByAreaId: { left: false, status: true } };

    persistence.setPanelStates(panels);

    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "panels", "project:one"))).toBe(
      JSON.stringify(panels),
    );
    expect(persistence.getPanelStates()).toEqual(panels);
  });

  test("ignores malformed persisted JSON", () => {
    const storage = createStore();
    storage.setItem(workbenchStoragePersistenceKey("demo", "layout", "project:one"), "{");

    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });

    expect(persistence.getLayout("project:one")).toBeUndefined();
  });
});
