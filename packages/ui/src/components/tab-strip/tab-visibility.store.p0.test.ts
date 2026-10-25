import { beforeEach, describe, expect, test } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createTabVisibilityStore } from "./tab-visibility.store";

const STORAGE_KEY = "test-tab-vis";

beforeEach(() => {
  installMockLocalStorage();
});

describe("createTabVisibilityStore", () => {
  test("starts empty", () => {
    const store = createTabVisibilityStore({ storageKey: STORAGE_KEY });
    expect(store.getState().tabOverrides).toEqual({});
  });

  test("toggleTab flips effective visibility around the contribution default", () => {
    const store = createTabVisibilityStore({ storageKey: STORAGE_KEY });

    store.getState().toggleTab("main:foo", false);
    expect(store.getState().tabOverrides["main:foo"]).toBe("hidden");

    store.getState().toggleTab("main:foo", false);
    expect(store.getState().tabOverrides["main:foo"]).toBe("shown");

    store.getState().toggleTab("main:bar", true);
    expect(store.getState().tabOverrides["main:bar"]).toBe("shown");
  });

  test("setTab undefined clears the entry", () => {
    const store = createTabVisibilityStore({ storageKey: STORAGE_KEY });
    store.getState().setTab("main:foo", "hidden");
    store.getState().setTab("main:foo", undefined);
    expect(store.getState().tabOverrides).toEqual({});
  });

  test("persists across new instances", () => {
    const first = createTabVisibilityStore({ storageKey: STORAGE_KEY });
    first.getState().setTab("main:foo", "hidden");

    const second = createTabVisibilityStore({ storageKey: STORAGE_KEY });
    expect(second.getState().tabOverrides).toEqual({ "main:foo": "hidden" });
  });

  test("reset clears all overrides", () => {
    const store = createTabVisibilityStore({ storageKey: STORAGE_KEY });
    store.getState().setTab("main:foo", "hidden");
    store.getState().setTab("main:bar", "shown");
    store.getState().reset();
    expect(store.getState().tabOverrides).toEqual({});
  });
});
