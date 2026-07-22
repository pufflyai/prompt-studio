import { beforeEach, describe, expect, it } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createSidenavStore } from "./sidenav.store";

const STORAGE_KEY = "test-sidenav";

beforeEach(() => {
  installMockLocalStorage();
});

describe("createSidenavStore", () => {
  it("starts open by default", () => {
    const store = createSidenavStore({ storageKey: STORAGE_KEY });

    expect(store.getState().open).toBe(true);
    expect(store.getState().expandedSections).toEqual([]);
    expect(store.getState().expandedNodes).toEqual([]);
  });

  it("supports close and reopen", () => {
    const store = createSidenavStore({ storageKey: STORAGE_KEY });

    store.getState().closeSidenav();
    expect(store.getState().open).toBe(false);

    store.getState().openSidenav();
    expect(store.getState().open).toBe(true);
  });

  it("restores persisted state for matching key", () => {
    const firstStore = createSidenavStore({ storageKey: STORAGE_KEY });
    firstStore.getState().closeSidenav();
    firstStore.getState().toggleSection("sec-1");
    firstStore.getState().toggleNode("node-1");

    const secondStore = createSidenavStore({ storageKey: STORAGE_KEY });

    expect(secondStore.getState().open).toBe(false);
    expect(secondStore.getState().expandedSections).toEqual(["sec-1"]);
    expect(secondStore.getState().expandedNodes).toEqual(["node-1"]);
  });

  it("isolates persisted state by storage key", () => {
    const firstStore = createSidenavStore({ storageKey: "alpha" });
    firstStore.getState().closeSidenav();

    const secondStore = createSidenavStore({ storageKey: "beta" });

    expect(secondStore.getState().open).toBe(true);
  });
});
