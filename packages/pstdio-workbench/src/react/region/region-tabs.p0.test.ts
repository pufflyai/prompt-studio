import { describe, expect, test } from "bun:test";
import { shouldShowPanelHeader } from "./region-tabs";

describe("WorkbenchRegionTabs leading actions", () => {
  test("keeps the panel header visible when only leading actions remain", () => {
    expect(shouldShowPanelHeader({ hasHeaderActions: true })).toBe(true);
  });

  test("keeps the panel header visible for a panel-menu-only composition", () => {
    expect(shouldShowPanelHeader({ hasPanelMenus: true })).toBe(true);
  });

  test("omits the panel header for location content without subordinate chrome", () => {
    expect(shouldShowPanelHeader({})).toBe(false);
  });
});
