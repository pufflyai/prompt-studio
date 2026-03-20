import { beforeEach, describe, expect, it } from "bun:test";

import { createTicketsWorkspaceStore } from "./use-workspace-store";

const STORAGE_KEY = "workspace-test";

beforeEach(() => {
  const storage = new Map<string, string>();

  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
  };
});

describe("createTicketsWorkspaceStore", () => {
  it("starts with default snapshot", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    expect(store.getState().settings.viewMode).toBe("board");
    expect(store.getState().settings.columnGrouping).toBe("status");
    expect(store.getState().settings.rowGrouping).toBe("none");
    expect(store.getState().settings.ordering.field).toBe("manual");
    expect(store.getState().settings.ordering.direction).toBe("asc");
    expect(store.getState().filters).toEqual({});
  });

  it("updates view mode", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    store.getState().setViewMode("list");

    expect(store.getState().settings.viewMode).toBe("list");
  });

  it("updates column and row grouping independently", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    store.getState().setColumnGrouping("complexity");
    store.getState().setRowGrouping("assignee");

    expect(store.getState().settings.columnGrouping).toBe("complexity");
    expect(store.getState().settings.rowGrouping).toBe("assignee");
  });

  it("updates ordering field and toggles sort direction", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    store.getState().setOrderingField("updated");
    expect(store.getState().settings.ordering.field).toBe("updated");

    store.getState().toggleSortDirection();
    expect(store.getState().settings.ordering.direction).toBe("desc");
  });

  it("toggles display property", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    store.getState().toggleDisplayProperty("status");
    expect(store.getState().settings.displayProperties).toContain("status");

    store.getState().toggleDisplayProperty("status");
    expect(store.getState().settings.displayProperties).not.toContain("status");
  });

  it("sets and clears filters", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    store.getState().setFilter("status", ["todo", "in_progress"]);
    expect(store.getState().filters.status).toEqual(["todo", "in_progress"]);

    store.getState().clearFilter("status");
    expect(store.getState().filters.status).toBeUndefined();
  });

  it("toggles filter values and clears all", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    store.getState().toggleFilterValue("status", "todo");
    store.getState().toggleFilterValue("status", "in_progress");
    expect(store.getState().filters.status).toEqual(["todo", "in_progress"]);

    store.getState().toggleFilterValue("status", "todo");
    expect(store.getState().filters.status).toEqual(["in_progress"]);

    store.getState().clearAllFilters();
    expect(store.getState().filters).toEqual({});
  });

  it("persists state for the same storage key", () => {
    const firstStore = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    firstStore.getState().setViewMode("list");
    firstStore.getState().setColumnGrouping("assignee");
    firstStore.getState().setFilter("status", ["todo"]);

    const secondStore = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });

    expect(secondStore.getState().settings.viewMode).toBe("list");
    expect(secondStore.getState().settings.columnGrouping).toBe("assignee");
    expect(secondStore.getState().filters.status).toEqual(["todo"]);
  });
});
