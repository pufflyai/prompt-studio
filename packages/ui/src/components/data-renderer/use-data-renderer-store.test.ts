import { beforeEach, describe, expect, it } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createDataRendererStore, getDataRendererStore } from "./use-data-renderer-store";

const STORAGE_KEY = "workspace-test";

beforeEach(() => {
  installMockLocalStorage();
});

describe("createDataRendererStore", () => {
  it("starts with default snapshot", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    expect(store.getState().settings.viewMode).toBe("board");
    expect(store.getState().settings.columnGrouping).toBe("none");
    expect(store.getState().settings.rowGrouping).toBe("none");
    expect(store.getState().settings.ordering.attributeId).toBe("manual");
    expect(store.getState().settings.ordering.direction).toBe("asc");
    expect(store.getState().filters).toEqual({});
  });

  it("starts keyed stores with the supplied initial snapshot", () => {
    const store = getDataRendererStore("workspace-initial-state-test", {
      settings: {
        viewMode: "list",
        columnGrouping: "status",
        rowGrouping: "type",
        ordering: { attributeId: "updated", direction: "desc" },
        displayProperties: ["status"],
      },
      filters: { status: ["running"] },
    });

    expect(store.getState().settings.viewMode).toBe("list");
    expect(store.getState().settings.rowGrouping).toBe("type");
    expect(store.getState().settings.ordering).toEqual({ attributeId: "updated", direction: "desc" });
    expect(store.getState().filters.status).toEqual(["running"]);
  });

  it("updates view mode", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().setViewMode("list");
    expect(store.getState().settings.viewMode).toBe("list");
  });

  it("updates column and row grouping independently", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().setColumnGrouping("assignee");
    store.getState().setRowGrouping("status");

    expect(store.getState().settings.columnGrouping).toBe("assignee");
    expect(store.getState().settings.rowGrouping).toBe("status");
  });

  it("updates ordering attribute id and toggles sort direction", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().setOrderingAttributeId("updated");
    expect(store.getState().settings.ordering.attributeId).toBe("updated");

    store.getState().toggleSortDirection();
    expect(store.getState().settings.ordering.direction).toBe("desc");
  });

  it("toggles display property", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().toggleDisplayProperty("status");
    expect(store.getState().settings.displayProperties).toContain("status");

    store.getState().toggleDisplayProperty("status");
    expect(store.getState().settings.displayProperties).not.toContain("status");
  });

  it("sets and clears filters", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().setFilter("status", ["todo", "in_progress"]);
    expect(store.getState().filters.status).toEqual(["todo", "in_progress"]);

    store.getState().clearFilter("status");
    expect(store.getState().filters.status).toBeUndefined();
  });

  it("toggles filter values and clears all", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().toggleFilterValue("status", "todo");
    store.getState().toggleFilterValue("status", "in_progress");
    expect(store.getState().filters.status).toEqual(["todo", "in_progress"]);

    store.getState().toggleFilterValue("status", "todo");
    expect(store.getState().filters.status).toEqual(["in_progress"]);

    store.getState().clearAllFilters();
    expect(store.getState().filters).toEqual({});
  });

  it("persists state for the same storage key", () => {
    const firstStore = createDataRendererStore({ storageKey: STORAGE_KEY });

    firstStore.getState().setViewMode("list");
    firstStore.getState().setColumnGrouping("assignee");
    firstStore.getState().setFilter("status", ["todo"]);
    firstStore.getState().setExpandedGroup("group::done", false);

    const secondStore = createDataRendererStore({ storageKey: STORAGE_KEY });

    expect(secondStore.getState().settings.viewMode).toBe("list");
    expect(secondStore.getState().settings.columnGrouping).toBe("assignee");
    expect(secondStore.getState().filters.status).toEqual(["todo"]);
    expect(secondStore.getState().expandedGroups["group::done"]).toBe(false);
  });

  it("falls back when browser storage is blocked", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage blocked");
      },
    });

    const store = createDataRendererStore({ storageKey: "sandboxed-frame" });

    expect(store.getState().settings.viewMode).toBe("board");
    expect(() => store.getState().setViewMode("list")).not.toThrow();
    expect(store.getState().settings.viewMode).toBe("list");
  });

  it("migrates a legacy v1 persisted snapshot into v2 attribute-id keys", () => {
    const legacyState = {
      state: {
        settings: {
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { field: "updated", direction: "desc" },
          displayProperties: ["status", "tag:priority", "id"],
        },
        filters: {
          status: ["todo"],
          "tag:priority": ["high"],
        },
      },
      version: 1,
    };

    globalThis.localStorage.setItem(`pstdio/ui/data-renderer/${STORAGE_KEY}`, JSON.stringify(legacyState));

    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    expect(store.getState().settings.ordering.attributeId).toBe("updated");
    expect(store.getState().settings.ordering.direction).toBe("desc");
    expect(store.getState().settings.displayProperties).toEqual(["status", "priority", "id"]);
    expect(store.getState().filters.priority).toEqual(["high"]);
    expect(store.getState().filters.status).toEqual(["todo"]);
    expect(store.getState().filters).not.toHaveProperty("tag:priority");
  });
});
