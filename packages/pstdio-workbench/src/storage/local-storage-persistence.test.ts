import { describe, expect, test } from "bun:test";
import { createDefaultWorkbenchLayout, type PersistedTreeRendererStates, type PersistedWorkbenchPanels } from "../core";
import {
  createLocalStorageLastResourcePersistence,
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
  test("persists scoped layouts in one namespace-kind bucket", () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });
    const layout = createDefaultWorkbenchLayout();
    const scope = { mode: "workspace", resource: "workspace:one" };

    persistence.setLayout(layout, scope);

    expect(workbenchStoragePersistenceKey("demo", "layout")).toBe("demo:layout");
    expect(JSON.parse(storage.getItem("demo:layout") ?? "{}")).toMatchObject({
      "mode:workspace:resource:workspace%3Aone": { layout },
    });
    expect(persistence.getLayout(scope)).toEqual(layout);
    expect(persistence.getLayout({ mode: "workspace", resource: "workspace:two" })).toBeUndefined();
  });

  test("evicts least-recently-used resource scopes while pinning project scopes", () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });
    persistence.setLayout(createDefaultWorkbenchLayout(), { mode: "workspace" });

    for (let index = 0; index < 49; index += 1) {
      const layout = createDefaultWorkbenchLayout();
      layout.nodes.main = { size: index };
      persistence.setLayout(layout, { mode: "workspace", resource: `workspace:${index}` });
    }
    persistence.getLayout({ mode: "workspace", resource: "workspace:0" });
    for (let index = 49; index < 51; index += 1) {
      const layout = createDefaultWorkbenchLayout();
      layout.nodes.main = { size: index };
      persistence.setLayout(layout, { mode: "workspace", resource: `workspace:${index}` });
    }

    expect(persistence.getLayout({ mode: "workspace" })).toBeDefined();
    expect(persistence.getLayout({ mode: "workspace", resource: "workspace:0" })?.nodes.main?.size).toBe(0);
    expect(persistence.getLayout({ mode: "workspace", resource: "workspace:1" })).toBeUndefined();
    expect(persistence.getLayout({ mode: "workspace", resource: "workspace:50" })?.nodes.main?.size).toBe(50);
    expect(Object.keys(JSON.parse(storage.getItem("demo:layout") ?? "{}"))).toHaveLength(50);
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

    expect(JSON.parse(storage.getItem(workbenchStoragePersistenceKey("demo", "panels")) ?? "{}")).toEqual({
      "project:one": panels,
    });
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

    expect(JSON.parse(storage.getItem(workbenchStoragePersistenceKey("demo", "tree")) ?? "{}")).toEqual({
      "project:one": trees,
    });
    expect(persistence.getTreeStates()).toEqual(trees);
  });

  test("creates a unified persistence bundle for common workbench state", () => {
    const storage = createStore();
    const persistence = createLocalStorageWorkbenchPersistence({
      namespace: "demo",
      scope: "project:one",
      storage,
    });
    const panels: PersistedWorkbenchPanels = { openByAreaId: { left: false } };
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
    const layout = createDefaultWorkbenchLayout();
    layout.nodes.left = { collapsed: true, size: 280 };

    persistence.layoutPersistence.setLayout(layout, { mode: "workspace", resource: "workspace:one" });
    persistence.panelsPersistence.setPanelStates(panels);
    persistence.treePersistence.setTreeStates(trees);
    persistence.lastResourcePersistence.setLastResource(resource);

    expect(persistence.layoutPersistence.getLayout({ mode: "workspace", resource: "workspace:one" })).toEqual(layout);
    expect(persistence.panelsPersistence.getPanelStates()).toEqual(panels);
    expect(persistence.treePersistence.getTreeStates()).toEqual(trees);
    expect(persistence.lastResourcePersistence.getLastResource()).toEqual(resource);
  });

  test("ignores malformed persisted JSON", () => {
    const storage = createStore();
    storage.setItem(workbenchStoragePersistenceKey("demo", "layout"), "{");

    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });

    expect(persistence.getLayout({ mode: "workspace", resource: "workspace:one" })).toBeUndefined();
  });

  test("ignores quota errors in every adapter", () => {
    const storage: WorkbenchStorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    };

    const layout = createLocalStorageLayoutPersistence({ namespace: "demo", storage });
    const panels = createLocalStoragePanelsPersistence({ namespace: "demo", scope: "project:one", storage });
    const tree = createLocalStorageTreePersistence({ namespace: "demo", scope: "project:one", storage });
    const lastResource = createLocalStorageLastResourcePersistence({
      namespace: "demo",
      scope: "project:one",
      storage,
    });

    expect(() => layout.setLayout(createDefaultWorkbenchLayout(), { mode: "workspace" })).not.toThrow();
    expect(() => panels.setPanelStates({ openByAreaId: {} })).not.toThrow();
    expect(() => tree.setTreeStates({ statesByTreeId: {} })).not.toThrow();
    expect(() => lastResource.setLastResource({ kind: "workspace", uri: "workspace:one" })).not.toThrow();
    expect(() => lastResource.setLastResource(undefined)).not.toThrow();
  });

  test("rejects layout buckets over the serialized-size limit", () => {
    const storage = createStore();
    const persistence = createLocalStorageLayoutPersistence({ namespace: "demo", storage });
    const layout = createDefaultWorkbenchLayout();
    layout.areas.main?.widgets.push({
      widgetId: "large",
      contributionId: "large",
      resource: { kind: "large", uri: "large:one", metadata: { value: "x".repeat(1_100_000) } },
    });

    persistence.setLayout(layout, { mode: "workspace" });

    expect(storage.getItem("demo:layout")).toBeNull();
  });
});
