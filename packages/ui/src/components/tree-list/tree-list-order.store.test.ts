import { beforeEach, describe, expect, test } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createTreeListOrderStore } from "./tree-list-order.store";

const STORAGE_KEY = "test-tree-order";

beforeEach(() => {
  installMockLocalStorage();
});

describe("createTreeListOrderStore", () => {
  test("starts with empty order", () => {
    const store = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    expect(store.getState().sectionOrder).toEqual([]);
    expect(store.getState().nodeOrderBySection).toEqual({});
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

    const second = createTreeListOrderStore({ storageKey: STORAGE_KEY });
    expect(second.getState().sectionOrder).toEqual(["b", "a"]);
    expect(second.getState().nodeOrderBySection).toEqual({ "sec-1": ["y", "x"] });
  });
});
