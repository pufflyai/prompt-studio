import { beforeEach, describe, expect, it } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createTicketsWorkspaceStore } from "./use-workspace-store";

const STORAGE_KEY = "workspace-test";

beforeEach(() => {
  installMockLocalStorage();
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

    store.getState().setColumnGrouping("assignee");
    store.getState().setRowGrouping("status");

    expect(store.getState().settings.columnGrouping).toBe("assignee");
    expect(store.getState().settings.rowGrouping).toBe("status");
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

  it("sanitizes hidden assignee filters and display settings", () => {
    const store = createTicketsWorkspaceStore({
      storageKey: STORAGE_KEY,
      initialState: {
        settings: {
          viewMode: "board",
          columnGrouping: "assignee",
          rowGrouping: "assignee",
          ordering: { field: "manual", direction: "asc" },
          displayProperties: ["labels", "assignee", "status"],
        },
        filters: {
          status: ["todo"],
          assignee: ["alex"],
        },
      },
    });

    store.getState().sanitize({
      allowedDisplayProperties: ["id", "status", "labels", "updated"],
      allowedFilterCategories: ["status", "labels"],
      allowedGroupingFields: ["status", "none"],
      defaultColumnGrouping: "status",
      defaultRowGrouping: "none",
    });

    expect(store.getState().settings.columnGrouping).toBe("status");
    expect(store.getState().settings.rowGrouping).toBe("none");
    expect(store.getState().settings.displayProperties).toEqual(["labels", "status"]);
    expect(store.getState().filters).toEqual({ status: ["todo"] });
  });

  it("keeps assignee state when assignee remains an allowed option", () => {
    const store = createTicketsWorkspaceStore({
      storageKey: STORAGE_KEY,
      initialState: {
        settings: {
          viewMode: "board",
          columnGrouping: "assignee",
          rowGrouping: "none",
          ordering: { field: "manual", direction: "asc" },
          displayProperties: ["assignee", "labels"],
        },
        filters: {
          assignee: ["alex"],
        },
      },
    });

    store.getState().sanitize({
      allowedDisplayProperties: ["assignee", "labels"],
      allowedFilterCategories: ["assignee", "status", "labels"],
      allowedGroupingFields: ["assignee", "status", "none"],
      defaultColumnGrouping: "status",
      defaultRowGrouping: "none",
    });

    expect(store.getState().settings.columnGrouping).toBe("assignee");
    expect(store.getState().settings.displayProperties).toEqual(["assignee", "labels"]);
    expect(store.getState().filters.assignee).toEqual(["alex"]);
  });

  it("does not create new state objects when sanitize makes no changes", () => {
    const store = createTicketsWorkspaceStore({ storageKey: STORAGE_KEY });
    const beforeSettings = store.getState().settings;
    const beforeFilters = store.getState().filters;

    store.getState().sanitize({
      allowedDisplayProperties: ["labels"],
      allowedFilterCategories: ["status", "labels"],
      allowedGroupingFields: ["status", "none"],
      defaultColumnGrouping: "status",
      defaultRowGrouping: "none",
    });

    expect(store.getState().settings).toBe(beforeSettings);
    expect(store.getState().filters).toBe(beforeFilters);
  });
});
