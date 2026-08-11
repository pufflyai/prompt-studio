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
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

describe("local storage workbench persistence", () => {
  test("migrates version 1 layout and Panel state into one version 2 snapshot", () => {
    const storage = createStore();
    const scope = "project:one";
    const layoutKey = workbenchStoragePersistenceKey("demo", "layout", scope);
    const panelsKey = workbenchStoragePersistenceKey("demo", "panels", scope);
    const layout = createDefaultWorkbenchLayout({ secondary: true, sidenav: false });
    storage.setItem(layoutKey, JSON.stringify({ version: 1, layout }));
    storage.setItem(
      panelsKey,
      JSON.stringify({ openByRegionId: { secondary: false, sidenav: true, unknown: true, status: "invalid" } }),
    );
    const persistence = createLocalStorageWorkbenchPersistence({
      debounceMs: 60_000,
      namespace: "demo",
      storage,
    });

    const snapshot = persistence.snapshotPersistence.getSnapshot(scope);

    expect(snapshot?.layout.regions.secondary.visible).toBe(false);
    expect(snapshot?.layout.regions.sidenav.visible).toBe(true);
    expect(snapshot?.layout.regions.status.visible).toBe(true);
    persistence.snapshotPersistence.flush?.();
    expect(storage.getItem(layoutKey)).toBe(JSON.stringify({ version: 2, layout: snapshot?.layout }));
    expect(storage.getItem(panelsKey)).toBeNull();
  });

  test("debounces layout writes while exposing pending state to the active workbench", async () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({ debounceMs: 20, namespace: "demo", storage });
    const layout = createDefaultWorkbenchLayout();

    persistence.setLayout(layout, "project:one");

    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "layout", "project:one"))).toBeNull();
    expect(persistence.getLayout("project:one")).toEqual(layout);
    await Bun.sleep(25);
    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "layout", "project:one"))).toBe(
      JSON.stringify({ version: 2, layout }),
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

    persistence.snapshotPersistence.setSnapshot({ layout }, "project:one");
    persistence.snapshotPersistence.flush?.();
    persistence.treePersistence.setTreeStates(trees);
    persistence.lastResourcePersistence.setLastResource(resource);
    persistence.historyPersistence.setHistory(history, "project:one");

    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "layout", "project:one"))).toBe(
      JSON.stringify({ version: 2, layout }),
    );
    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "panels", "project:one"))).toBeNull();
    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "tree", "project:one"))).toBe(JSON.stringify(trees));
    expect(storage.getItem(workbenchStoragePersistenceKey("demo", "last-resource", "project:one"))).toBe(
      JSON.stringify(resource),
    );
    expect(persistence.snapshotPersistence.getSnapshot("project:one")).toEqual({ layout });
    expect(persistence.treePersistence.getTreeStates()).toEqual(trees);
    expect(persistence.lastResourcePersistence.getLastResource()).toEqual(resource);
    expect(persistence.historyPersistence.getHistory("project:one")).toEqual(history);
    expect(persistence.historyPersistence.getHistory("project:two")).toBeUndefined();
  });
});

describe("local storage workbench persistence recovery", () => {
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

  test("flushes pending layouts on page hide and disposal", () => {
    const storage = createStore();
    const listeners = new Set<() => void>();
    const eventTarget = {
      addEventListener: (_event: "pagehide", listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: "pagehide", listener: () => void) => listeners.delete(listener),
    };
    const persistence = createLocalStorageLayoutPersistence({
      debounceMs: 60_000,
      eventTarget,
      namespace: "demo",
      storage,
    });
    const layout = createDefaultWorkbenchLayout();

    persistence.setLayout(layout, "project/one/mode/workspace/resource/workspace://one");
    for (const listener of listeners) listener();
    expect(
      storage.getItem(
        workbenchStoragePersistenceKey("demo", "layout", "project/one/mode/workspace/resource/workspace://one"),
      ),
    ).not.toBeNull();

    persistence.setLayout(layout, "project/one/mode/workspace/resource/workspace://two");
    persistence.dispose?.();
    expect(
      storage.getItem(
        workbenchStoragePersistenceKey("demo", "layout", "project/one/mode/workspace/resource/workspace://two"),
      ),
    ).not.toBeNull();
    expect(listeners).toHaveLength(0);
  });

  test("rejects queued layout writes after the local generation advances", async () => {
    const storage = createStore();
    const listeners = new Set<() => void>();
    const eventTarget = {
      addEventListener: (_event: "pagehide", listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: "pagehide", listener: () => void) => listeners.delete(listener),
    };
    const persistence = createLocalStorageLayoutPersistence({
      debounceMs: 20,
      eventTarget,
      namespace: "demo",
      storage,
    });
    const stale = createDefaultWorkbenchLayout();
    const current = { ...stale, activeWidgetId: "current" };
    const scope = "project/one/mode/project/aggregate/workspaces";
    const key = workbenchStoragePersistenceKey("demo", "layout", scope);

    persistence.setLayout(stale, scope);
    persistence.advanceWriteGeneration?.();
    storage.setItem(key, JSON.stringify({ version: 2, layout: current }));

    for (const listener of listeners) listener();
    expect(persistence.getLayout(scope)).toEqual(current);
    await Bun.sleep(25);
    expect(JSON.parse(storage.getItem(key)!)).toEqual({ version: 2, layout: current });

    persistence.setLayout(stale, scope);
    persistence.advanceWriteGeneration?.();
    storage.setItem(key, JSON.stringify({ version: 2, layout: current }));
    persistence.dispose?.();
    expect(JSON.parse(storage.getItem(key)!)).toEqual({ version: 2, layout: current });
  });

  test("retains only the 50 most recent resource layouts per project", () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({
      debounceMs: 60_000,
      namespace: "demo",
      storage,
    });
    const layout = createDefaultWorkbenchLayout();
    const aggregateScope = "project/one/mode/project/aggregate/workspaces";
    persistence.setLayout(layout, aggregateScope);

    for (let index = 0; index < 51; index += 1) {
      persistence.setLayout(
        { ...layout, activeResourceUri: `workspace://${index}` },
        `project/one/mode/workspace/resource/workspace://${index}`,
      );
    }
    persistence.flush?.();

    expect(persistence.getLayout(aggregateScope)).toEqual(layout);
    expect(persistence.getLayout("project/one/mode/workspace/resource/workspace://0")).toBeUndefined();
    expect(persistence.getLayout("project/one/mode/workspace/resource/workspace://1")).toEqual({
      ...layout,
      activeResourceUri: "workspace://1",
    });
    expect(persistence.getLayout("project/one/mode/workspace/resource/workspace://50")).toEqual({
      ...layout,
      activeResourceUri: "workspace://50",
    });
  });

  test("rebuilds malformed or stale resource layout indexes", () => {
    const storage = createStore();
    const indexKey = workbenchStoragePersistenceKey("demo", "layout-resource-index", "one");
    storage.setItem(indexKey, JSON.stringify({ version: 1, scopes: "invalid" }));
    const persistence = createLocalStorageLayoutPersistence({
      debounceMs: 60_000,
      namespace: "demo",
      storage,
    });
    const layout = createDefaultWorkbenchLayout();
    const firstScope = "project/one/mode/workspace/resource/workspace://first";

    persistence.setLayout(layout, firstScope);
    expect(() => persistence.flush?.()).not.toThrow();

    const staleScopes = Array.from(
      { length: 50 },
      (_, index) => `project/one/mode/workspace/resource/workspace://stale-${index}`,
    );
    storage.setItem(indexKey, JSON.stringify({ version: 1, scopes: staleScopes }));
    const secondScope = "project/one/mode/workspace/resource/workspace://second";
    persistence.setLayout(layout, secondScope);
    persistence.flush?.();

    expect(JSON.parse(storage.getItem(indexKey)!)).toEqual({
      version: 1,
      scopes: [secondScope],
    });
    expect(persistence.getLayout(firstScope)).toEqual(layout);
    expect(persistence.getLayout(secondScope)).toEqual(layout);
  });

  test("enumerates and transforms project layout scopes without touching other projects", () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({
      debounceMs: 60_000,
      namespace: "demo",
      storage,
    });
    const one = createDefaultWorkbenchLayout();
    const two = { ...one, activeWidgetId: "two" };
    const other = { ...one, activeWidgetId: "other" };

    persistence.setLayout(one, "project/one");
    persistence.setLayout(two, "project/one/mode/workspace/resource/workspace://two");
    persistence.setLayout(other, "project/two");
    persistence.flush?.();

    expect(persistence.listScopes?.("one")).toEqual([
      "project/one",
      "project/one/mode/workspace/resource/workspace://two",
    ]);

    persistence.transformLayouts?.("one", (layout) => ({ ...layout, activeWidgetId: "changed" }));

    expect(persistence.getLayout("project/one")?.activeWidgetId).toBe("changed");
    expect(persistence.getLayout("project/one/mode/workspace/resource/workspace://two")?.activeWidgetId).toBe(
      "changed",
    );
    expect(persistence.getLayout("project/two")?.activeWidgetId).toBe("other");
  });

  test("transforms the newest queued layout before fencing older writers", () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({
      debounceMs: 60_000,
      namespace: "demo",
      storage,
    });
    const scope = "project/one/mode/project/aggregate/workspaces";
    const persisted = { ...createDefaultWorkbenchLayout(), activeWidgetId: "persisted" };
    const queued = { ...persisted, activeWidgetId: "queued" };

    persistence.setLayout(persisted, scope);
    persistence.flush?.();
    persistence.setLayout(queued, scope);

    persistence.transformLayouts?.("one", (layout) => ({ ...layout, activeResourceUri: "resource://current" }));

    expect(persistence.getLayout(scope)).toEqual({
      ...queued,
      activeResourceUri: "resource://current",
    });
  });

  test("discovers project layouts that predate the scope index", () => {
    const storage = createStore();
    const layout = createDefaultWorkbenchLayout();
    const projectScope = "project/one";
    const aggregateScope = "project/one/mode/project/aggregate/workspaces";
    storage.setItem(
      workbenchStoragePersistenceKey("demo", "layout", projectScope),
      JSON.stringify({ version: 2, layout }),
    );
    storage.setItem(
      workbenchStoragePersistenceKey("demo", "layout", aggregateScope),
      JSON.stringify({ version: 2, layout }),
    );
    storage.setItem(
      workbenchStoragePersistenceKey("demo", "layout", "project/two"),
      JSON.stringify({ version: 2, layout }),
    );
    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });

    expect(persistence.listScopes?.("one")).toEqual([projectScope, aggregateScope]);
  });
});

describe("unified local storage persistence options", () => {
  test("forwards layout scheduling options", async () => {
    const storage = createStore();
    const listeners = new Set<() => void>();
    const eventTarget = {
      addEventListener: (_event: "pagehide", listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: "pagehide", listener: () => void) => listeners.delete(listener),
    };
    const persistence = createLocalStorageWorkbenchPersistence({
      debounceMs: 5,
      eventTarget,
      namespace: "demo",
      storage,
    });
    const layout = createDefaultWorkbenchLayout();
    const key = workbenchStoragePersistenceKey("demo", "layout", "project:one");

    persistence.layoutPersistence.setLayout(layout, "project:one");

    expect(listeners).toHaveLength(1);
    expect(storage.getItem(key)).toBeNull();
    await Bun.sleep(10);
    expect(storage.getItem(key)).toBe(JSON.stringify({ version: 2, layout }));

    persistence.layoutPersistence.dispose?.();
    expect(listeners).toHaveLength(0);
  });
});
