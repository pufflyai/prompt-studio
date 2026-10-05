import { beforeEach, describe, expect, test } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createTreeListOrderStore, getTreeListOrderStore } from "./tree-list-order.store";

const STORAGE_KEY = "test-tree-order";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

beforeEach(() => {
  installMockLocalStorage();
});

describe("createTreeListOrderStore", () => {
  test("starts with empty order", () => {
    const store = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    expect(store.getState().sectionOrder).toEqual([]);
    expect(store.getState().nodeOrderBySection).toEqual({});
    expect(store.getState().sectionSlotById).toEqual({});
  });

  test("setSectionOrder dedupes input", () => {
    const store = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    store.getState().setSectionOrder(["a", "b", "a", "c", "b"]);
    expect(store.getState().sectionOrder).toEqual(["a", "b", "c"]);
  });

  test("setNodeOrder stores per-section arrays and dedupes", () => {
    const store = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    store.getState().setNodeOrder("sec-1", ["x", "y", "x"]);
    store.getState().setNodeOrder("sec-2", ["z"]);
    expect(store.getState().nodeOrderBySection).toEqual({ "sec-1": ["x", "y"], "sec-2": ["z"] });
  });

  test("stores a section's selected pinned or scrolling slot", () => {
    const store = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    store.getState().setSectionSlot("tickets", "footer");
    expect(store.getState().sectionSlotById).toEqual({ tickets: "footer" });
  });

  test("resetSectionOrder + resetNodeOrder clear targeted state", () => {
    const store = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    store.getState().setSectionOrder(["a", "b"]);
    store.getState().setNodeOrder("sec-1", ["x"]);

    store.getState().resetSectionOrder();
    expect(store.getState().sectionOrder).toEqual([]);

    store.getState().resetNodeOrder("sec-1");
    expect(store.getState().nodeOrderBySection).toEqual({});

    // resetting a missing section is a no-op
    const before = store.getState();
    store.getState().resetNodeOrder("sec-1");
    expect(store.getState()).toBe(before);
  });

  test("persists across new instances with the same key", () => {
    const first = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    first.getState().setSectionOrder(["b", "a"]);
    first.getState().setNodeOrder("sec-1", ["y", "x"]);
    first.getState().setSectionSlot("sec-1", "header");

    const second = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    expect(second.getState().sectionOrder).toEqual(["b", "a"]);
    expect(second.getState().nodeOrderBySection).toEqual({ "sec-1": ["y", "x"] });
    expect(second.getState().sectionSlotById).toEqual({ "sec-1": "header" });
  });

  test("restores order and placement from host storage instead of browser storage", () => {
    const storage = memoryStorage();
    const first = createTreeListOrderStore({ storageKey: STORAGE_KEY, storage });
    first.getState().setSectionOrder(["b", "a"]);
    first.getState().setNodeOrder("sec-1", ["y", "x"]);
    first.getState().setSectionSlot("sec-1", "footer");

    expect(globalThis.localStorage.length).toBe(0);
    const restored = createTreeListOrderStore({ storageKey: STORAGE_KEY, storage }).getState();
    expect(restored.sectionOrder).toEqual(["b", "a"]);
    expect(restored.nodeOrderBySection).toEqual({ "sec-1": ["y", "x"] });
    expect(restored.sectionSlotById).toEqual({ "sec-1": "footer" });
  });

  test("keeps a reset after the store is created again", () => {
    const storage = memoryStorage();
    const first = createTreeListOrderStore({ storageKey: STORAGE_KEY, storage });
    first.getState().setSectionOrder(["b", "a"]);
    first.getState().reset();

    expect(createTreeListOrderStore({ storageKey: STORAGE_KEY, storage }).getState().sectionOrder).toEqual([]);
  });

  test("shares stores only within the same host storage and key", () => {
    const storage = memoryStorage();
    const first = getTreeListOrderStore("tree:project-a", storage);
    first.getState().setSectionOrder(["b", "a"]);

    expect(getTreeListOrderStore("tree:project-a", storage)).toBe(first);
    expect(getTreeListOrderStore("tree:project-b", storage).getState().sectionOrder).toEqual([]);
    expect(getTreeListOrderStore("tree:project-a", memoryStorage()).getState().sectionOrder).toEqual([]);
    expect(getTreeListOrderStore("tree:project-a").getState().sectionOrder).toEqual([]);
  });
});
