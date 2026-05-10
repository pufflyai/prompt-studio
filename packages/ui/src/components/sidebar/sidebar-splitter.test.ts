import { describe, expect, it } from "bun:test";
import { createSidebarStore } from "./sidebar.store";
import { resolveSidebarResizeEnd, resolveSidebarSplitterSize, resolveSidebarWidth } from "./sidebar-splitter";

describe("sidebar splitter sizing", () => {
  it("converts persisted sidebar width into splitter panel percentages", () => {
    expect(resolveSidebarSplitterSize({ panelWidth: 1000, sidebarWidth: 240, minWidth: 200, maxWidth: 480 })).toEqual([
      24, 76,
    ]);
  });

  it("clamps persisted width before calculating splitter panel percentages", () => {
    expect(resolveSidebarSplitterSize({ panelWidth: 1000, sidebarWidth: 160, minWidth: 200, maxWidth: 480 })).toEqual([
      20, 80,
    ]);
  });

  it("converts splitter percentage changes back into sidebar width", () => {
    expect(resolveSidebarWidth(1000, 32)).toBe(320);
  });

  it("closes the sidebar store when splitter resize ends below the minimum width", () => {
    const store = createSidebarStore({ storageKey: "splitter-collapse" });
    const result = resolveSidebarResizeEnd({ panelWidth: 1000, sidebarSize: 19, minWidth: 200 });

    if (result.type === "collapse") {
      store.getState().closeSidebar();
    }

    expect(store.getState().open).toBe(false);
  });

  it("reopens the sidebar store when splitter expands from the collapsed state", () => {
    const store = createSidebarStore({ storageKey: "splitter-expand" });

    store.getState().closeSidebar();
    store.getState().openSidebar();

    expect(store.getState().open).toBe(true);
  });

  it("persists width when splitter resize stays above the minimum width", () => {
    const store = createSidebarStore({ storageKey: "splitter-resize" });
    const result = resolveSidebarResizeEnd({ panelWidth: 1000, sidebarSize: 24, minWidth: 200 });

    if (result.type === "resize") {
      store.getState().setWidth(result.width);
    }

    expect(store.getState().open).toBe(true);
    expect(store.getState().width).toBe(240);
  });
});
