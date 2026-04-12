import { beforeEach, describe, expect, it } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { createSidebarStore } from "./sidebar.store";

const STORAGE_KEY = "test-sidebar";

beforeEach(() => {
  installMockLocalStorage();
});

describe("createSidebarStore", () => {
  it("starts open by default", () => {
    const store = createSidebarStore({ storageKey: STORAGE_KEY });

    expect(store.getState().open).toBe(true);
    expect(store.getState().expandedSections).toEqual([]);
    expect(store.getState().expandedNodes).toEqual([]);
  });

  it("supports close and reopen", () => {
    const store = createSidebarStore({ storageKey: STORAGE_KEY });

    store.getState().closeSidebar();
    expect(store.getState().open).toBe(false);

    store.getState().openSidebar();
    expect(store.getState().open).toBe(true);
  });

  it("restores persisted state for matching key", () => {
    const firstStore = createSidebarStore({ storageKey: STORAGE_KEY });
    firstStore.getState().closeSidebar();
    firstStore.getState().toggleSection("sec-1");
    firstStore.getState().toggleNode("node-1");

    const secondStore = createSidebarStore({ storageKey: STORAGE_KEY });

    expect(secondStore.getState().open).toBe(false);
    expect(secondStore.getState().expandedSections).toEqual(["sec-1"]);
    expect(secondStore.getState().expandedNodes).toEqual(["node-1"]);
  });

  it("isolates persisted state by storage key", () => {
    const firstStore = createSidebarStore({ storageKey: "alpha" });
    firstStore.getState().closeSidebar();

    const secondStore = createSidebarStore({ storageKey: "beta" });

    expect(secondStore.getState().open).toBe(true);
  });
});
