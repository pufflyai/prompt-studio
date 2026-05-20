import { describe, expect, test } from "bun:test";
import {
  createDashboardLayoutPersistence,
  createDashboardPanelsPersistence,
  PERSISTENCE_NAMESPACE,
  persistenceStorageKey,
  projectLayoutScope,
} from "./workbench-persistence";

const createMemoryStore = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

describe("persistence keys", () => {
  test("scopes layout keys per project", () => {
    expect(projectLayoutScope("proj-1")).toBe("project:proj-1");
    expect(persistenceStorageKey("layout", projectLayoutScope("proj-1"))).toBe(
      `${PERSISTENCE_NAMESPACE}:layout:project:proj-1`,
    );
  });

  test("falls back to a global key when no scope is given", () => {
    expect(persistenceStorageKey("panels", undefined)).toBe(`${PERSISTENCE_NAMESPACE}:panels:global`);
  });
});

describe("layout persistence adapter", () => {
  test("round-trips a layout for a scope without leaking across scopes", () => {
    const store = createMemoryStore();
    const adapter = createDashboardLayoutPersistence(store);
    const layout = { areas: {}, activeWidgetId: "w1" } as never;

    adapter.setLayout(layout, projectLayoutScope("proj-1"));

    expect(adapter.getLayout(projectLayoutScope("proj-1"))).toEqual(layout);
    expect(adapter.getLayout(projectLayoutScope("proj-2"))).toBeUndefined();
  });
});

describe("panels persistence adapter", () => {
  test("persists panel states under the bound project scope", () => {
    const store = createMemoryStore();
    const adapter = createDashboardPanelsPersistence(projectLayoutScope("proj-1"), store);

    adapter.setPanelStates({ openByAreaId: { left: false } });

    expect(adapter.getPanelStates()).toEqual({ openByAreaId: { left: false } });
    expect(store.map.has(`${PERSISTENCE_NAMESPACE}:panels:project:proj-1`)).toBe(true);
  });
});
