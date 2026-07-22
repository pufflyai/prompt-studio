import { describe, expect, test } from "bun:test";
import {
  createDefaultWorkbenchLayout,
  type PersistedTreeRendererStates,
  type PersistedWorkbenchHistory,
  type PersistedWorkbenchPanels,
} from "../core";
import {
  createLocalStorageLayoutPersistence,
  createLocalStoragePanelsPersistence,
  createLocalStorageTreePersistence,
  createLocalStorageWorkbenchPersistence,
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
      JSON.stringify({ version: 1, layout }),
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
    const panels: PersistedWorkbenchPanels = { openByRegionId: { sidenav: false, status: true } };

    persistence.setPanelStates(panels);

    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "panels", "project:one"))).toBe(
      JSON.stringify(panels),
    );
    expect(persistence.getPanelStates()).toEqual(panels);
  });

  test("persists tree state by namespace and scope", () => {
    const storage = createStore();
    const persistence = createLocalStorageTreePersistence({
      namespace: "demo",
      scope: "project:one",
      storage,
    });
    const trees: PersistedTreeRendererStates = {
      statesByTreeId: {
        "workspace.tree": {
          expandedNodeIds: ["workspace:one"],
          expandedSectionIds: ["sessions"],
          selectedNodeId: "workspace:one",
        },
      },
    };

    persistence.setTreeStates(trees);

    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "tree", "project:one"))).toBe(JSON.stringify(trees));
    expect(persistence.getTreeStates()).toEqual(trees);
  });

  test("creates a unified persistence bundle for common workbench state", () => {
    const storage = createStore();
    const persistence = createLocalStorageWorkbenchPersistence({
      namespace: "demo",
      scope: "project:one",
      storage,
    });
    const panels: PersistedWorkbenchPanels = { openByRegionId: { sidenav: false } };
    const layout = createDefaultWorkbenchLayout();
    const trees: PersistedTreeRendererStates = {
      statesByTreeId: {
        "workspace.tree": {
          expandedNodeIds: ["workspace:one"],
          expandedSectionIds: ["sessions"],
          selectedNodeId: "workspace:one",
        },
      },
    };
    const resource = { kind: "workspace", uri: "workspace:one", label: "Workspace One" };
    const history: PersistedWorkbenchHistory = {
      version: 1,
      cursor: 0,
      entries: [
        {
          entryId: "entry-one",
          recordedAt: 1,
          kind: "widget",
          location: { key: "location:one", contributionId: "location.one" },
          selectedSubPanels: {},
        },
      ],
      recentlyClosed: [],
    };

    persistence.layoutPersistence.setLayout(layout, "project:one");
    persistence.panelsPersistence.setPanelStates(panels);
    persistence.treePersistence.setTreeStates(trees);
    persistence.lastResourcePersistence.setLastResource(resource);
    persistence.historyPersistence.setHistory(history, "project:one");

    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "layout", "project:one"))).toBe(
      JSON.stringify({ version: 1, layout }),
    );
    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "panels", "project:one"))).toBe(
      JSON.stringify(panels),
    );
    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "tree", "project:one"))).toBe(JSON.stringify(trees));
    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "last-resource", "project:one"))).toBe(
      JSON.stringify(resource),
    );
    expect(persistence.layoutPersistence.getLayout("project:one")).toEqual(layout);
    expect(persistence.panelsPersistence.getPanelStates()).toEqual(panels);
    expect(persistence.treePersistence.getTreeStates()).toEqual(trees);
    expect(persistence.lastResourcePersistence.getLastResource()).toEqual(resource);
    expect(persistence.historyPersistence.getHistory("project:one")).toEqual(history);
    expect(persistence.historyPersistence.getHistory("project:two")).toBeUndefined();
  });

  test("ignores malformed persisted JSON", () => {
    const storage = createStore();
    storage.setItem(workbenchStoragePersistenceKey("demo", "layout", "project:one"), "{");

    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });

    expect(persistence.getLayout("project:one")).toBeUndefined();
  });

  test("invalidates layout state from an incompatible schema version", () => {
    const storage = createStore();
    const key = workbenchStoragePersistenceKey("demo", "layout", "project:one");
    storage.setItem(key, JSON.stringify({ version: 0, layout: createDefaultWorkbenchLayout() }));

    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });

    expect(persistence.getLayout("project:one")).toBeUndefined();
  });
});
