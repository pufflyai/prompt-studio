import { beforeEach, describe, expect, it } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createDataRendererStore } from "./use-data-renderer-store";

const STORAGE_KEY = "workspace-test";

beforeEach(() => {
  installMockLocalStorage();
});

describe("createDataRendererStore", () => {
  it("starts with default snapshot", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    expect(store.getState().settings.viewMode).toBe("board");
    expect(store.getState().settings.columnGrouping).toBe("status");
    expect(store.getState().settings.rowGrouping).toBe("none");
    expect(store.getState().settings.ordering.field).toBe("manual");
    expect(store.getState().settings.ordering.direction).toBe("asc");
    expect(store.getState().filters).toEqual({});
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

  it("updates ordering field and toggles sort direction", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().setOrderingField("updated");
    expect(store.getState().settings.ordering.field).toBe("updated");

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

  it("sets display properties", () => {
    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    store.getState().setDisplayProperties(["id", "assignee"]);

    expect(store.getState().settings.displayProperties).toEqual(["id", "assignee"]);
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

    const secondStore = createDataRendererStore({ storageKey: STORAGE_KEY });

    expect(secondStore.getState().settings.viewMode).toBe("list");
    expect(secondStore.getState().settings.columnGrouping).toBe("assignee");
    expect(secondStore.getState().filters.status).toEqual(["todo"]);
  });

  it("migrates legacy labels filter and display property from v0", () => {
    const legacyState = {
      state: {
        settings: {
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { field: "manual", direction: "asc" },
          displayProperties: ["labels", "status"],
        },
        filters: {
          status: ["todo"],
          labels: ["frontend"],
        },
      },
      version: 0,
    };

    globalThis.localStorage.setItem(`pstdio/ui/tickets-workspace/${STORAGE_KEY}`, JSON.stringify(legacyState));

    const store = createDataRendererStore({ storageKey: STORAGE_KEY });

    expect(store.getState().filters).not.toHaveProperty("labels");
    expect(store.getState().filters.status).toEqual(["todo"]);
    expect(store.getState().settings.displayProperties).not.toContain("labels");
    expect(store.getState().settings.displayProperties).toContain("status");
  });
});
