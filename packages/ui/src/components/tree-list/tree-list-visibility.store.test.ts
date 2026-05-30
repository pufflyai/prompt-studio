import { beforeEach, describe, expect, test } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createTreeListVisibilityStore } from "./tree-list-visibility.store";

const STORAGE_KEY = "test-tree-vis";

beforeEach(() => {
  installMockLocalStorage();
});

describe("createTreeListVisibilityStore", () => {
  test("starts with empty overrides", () => {
    const store = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });

    expect(store.getState().sectionOverrides).toEqual({});
    expect(store.getState().nodeOverrides).toEqual({});
  });

  test("toggleSection flips effective visibility against the contribution default", () => {
    const store = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });

    store.getState().toggleSection("sec-1", false);
    expect(store.getState().sectionOverrides["sec-1"]).toBe("hidden");

    store.getState().toggleSection("sec-1", false);
    expect(store.getState().sectionOverrides["sec-1"]).toBe("shown");

    store.getState().toggleSection("sec-2", true);
    expect(store.getState().sectionOverrides["sec-2"]).toBe("shown");
  });

  test("toggleNode flips against node default", () => {
    const store = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });

    store.getState().toggleNode("node-1", true);
    expect(store.getState().nodeOverrides["node-1"]).toBe("shown");

    store.getState().toggleNode("node-1", true);
    expect(store.getState().nodeOverrides["node-1"]).toBe("hidden");
  });

  test("setSection / setNode with undefined clears the override", () => {
    const store = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });

    store.getState().setSection("sec-1", "hidden");
    store.getState().setNode("node-1", "shown");
    expect(store.getState().sectionOverrides["sec-1"]).toBe("hidden");
    expect(store.getState().nodeOverrides["node-1"]).toBe("shown");

    store.getState().setSection("sec-1", undefined);
    store.getState().setNode("node-1", undefined);
    expect(store.getState().sectionOverrides).toEqual({});
    expect(store.getState().nodeOverrides).toEqual({});
  });

  test("clearSection / clearNode remove the entry", () => {
    const store = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });
    store.getState().setSection("sec-1", "hidden");
    store.getState().setNode("node-1", "shown");

    store.getState().clearSection("sec-1");
    store.getState().clearNode("node-1");

    expect(store.getState().sectionOverrides).toEqual({});
    expect(store.getState().nodeOverrides).toEqual({});
  });

  test("reset wipes both maps", () => {
    const store = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });
    store.getState().setSection("sec-1", "hidden");
    store.getState().setNode("node-1", "shown");

    store.getState().reset();

    expect(store.getState().sectionOverrides).toEqual({});
    expect(store.getState().nodeOverrides).toEqual({});
  });

  test("persists across new store instances with the same key", () => {
    const first = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });
    first.getState().setSection("sec-1", "hidden");
    first.getState().setNode("node-1", "shown");

    const second = createTreeListVisibilityStore({ storageKey: STORAGE_KEY });
    expect(second.getState().sectionOverrides).toEqual({ "sec-1": "hidden" });
    expect(second.getState().nodeOverrides).toEqual({ "node-1": "shown" });
  });

  test("isolates state between distinct storage keys", () => {
    const a = createTreeListVisibilityStore({ storageKey: "project-a" });
    const b = createTreeListVisibilityStore({ storageKey: "project-b" });

    a.getState().setSection("sec-1", "hidden");

    expect(b.getState().sectionOverrides).toEqual({});
  });
});
