import { beforeEach, describe, expect, test } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { createCollectionViewStore, getCollectionViewStore } from "./use-collection-view-store";

const settings = { viewMode: "board", displayProperties: [] as string[] };
const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
const status: AttributeDescriptor = { id: "status", label: "Status", type: { kind: "enum", options: [] } };
const done = {
  conjunction: "and" as const,
  rules: [{ attributeId: "status", condition: "is-none-of" as const, value: ["done"] }],
};

beforeEach(() => {
  installMockLocalStorage();
});

describe("collection view store", () => {
  test("starts from the renderer's initial view state", () => {
    const store = createCollectionViewStore({
      storageKey: "initial",
      initialState: { settings, filter: done, sorts: [{ attributeId: "updated", direction: "desc" }] },
    });

    expect(store.getState()).toMatchObject({
      settings,
      filter: done,
      sorts: [{ attributeId: "updated", direction: "desc" }],
      activeViewId: "",
    });
  });

  test("restores the active view and unsaved edits from host storage, but not open menus", () => {
    const storage = memoryStorage();
    const options = { storageKey: "project-one/tickets", storage, initialState: { settings } };
    const first = createCollectionViewStore(options).getState();
    first.activateView({ id: "saved", title: "Saved", settings, filter: done, sorts: [] });
    first.setSettings({ viewMode: "list" });
    first.setSorts([{ attributeId: "title", direction: "asc" }]);
    first.setExpandedGroup("group::done", false);
    first.setOpenMenu("filter");

    const restored = createCollectionViewStore(options).getState();

    expect(restored).toMatchObject({
      activeViewId: "saved",
      settings: { viewMode: "list", displayProperties: [] },
      filter: done,
      sorts: [{ attributeId: "title", direction: "asc" }],
      expandedGroups: { "group::done": false },
      openMenu: null,
    });
  });

  test("restores one valid sort without losing version-five unsaved edits", () => {
    const storage = memoryStorage();
    storage.setItem(
      "pstdio/ui/kanban-renderer/one-sort",
      JSON.stringify({
        version: 5,
        state: {
          activeViewId: "saved",
          settings: { ...settings, viewMode: "list" },
          filter: done,
          expandedGroups: { done: false },
          sorts: [
            { attributeId: "title", direction: "asc" },
            { attributeId: "updated", direction: "desc" },
          ],
        },
      }),
    );
    const restored = createCollectionViewStore({
      storageKey: "one-sort",
      storage,
      initialState: { settings },
    }).getState();
    expect(restored).toMatchObject({
      activeViewId: "saved",
      settings: { ...settings, viewMode: "list" },
      filter: done,
      expandedGroups: { done: false },
      sorts: [{ attributeId: "title", direction: "asc" }],
    });
  });

  test("starts from the server's views when local state predates filter rules", () => {
    const storage = memoryStorage();
    storage.setItem(
      "pstdio/ui/kanban-renderer/old",
      JSON.stringify({ state: { filters: { status: ["todo"] }, activeViewId: "x" }, version: 4 }),
    );

    expect(
      createCollectionViewStore({ storageKey: "old", storage, initialState: { settings } }).getState(),
    ).toMatchObject({
      activeViewId: "",
      filter: { conjunction: "and", rules: [] },
    });
  });

  test("activating a view replaces the edits and closes rule editors", () => {
    const store = createCollectionViewStore({ storageKey: "activate", initialState: { settings } });
    store.getState().startRule(status);
    expect(store.getState().openRuleIndex).toBe(0);

    store.getState().activateView({ id: "all", title: "All", settings, filter: done, sorts: [] });

    expect(store.getState()).toMatchObject({ filter: done, openRuleIndex: null, expandedGroups: {} });
  });

  test("a new rule opens its editor with either conjunction", () => {
    const store = createCollectionViewStore({
      storageKey: "or-root",
      initialState: { settings, filter: { conjunction: "or", rules: [] } },
    });

    store.getState().startRule(status);

    expect(store.getState()).toMatchObject({ openMenu: null, openRuleIndex: 0 });
    expect(store.getState().filter.rules).toEqual([{ attributeId: "status", condition: "is-any-of" }]);
  });

  test("shares stores only within the same host and storage key", () => {
    const storage = memoryStorage();
    const first = getCollectionViewStore("tickets", { settings }, storage);
    first.getState().setFilter(done);

    expect(getCollectionViewStore("tickets", { settings }, storage)).toBe(first);
    expect(getCollectionViewStore("tickets", { settings }, memoryStorage()).getState().filter.rules).toEqual([]);
  });

  test("keeps working when browser storage is blocked", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage blocked");
      },
    });
    const store = createCollectionViewStore({ storageKey: "sandboxed-frame", initialState: { settings } });

    expect(() => store.getState().setSettings({ viewMode: "list" })).not.toThrow();
    expect(store.getState().settings.viewMode).toBe("list");
  });
});
