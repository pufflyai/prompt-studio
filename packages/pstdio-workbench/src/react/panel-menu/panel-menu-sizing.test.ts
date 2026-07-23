import { describe, expect, test } from "bun:test";
import { canAttachWorkbenchPanelMenu, shouldCollapseWorkbenchPanelMenus } from "./panel-menu-sizing";

describe("shouldCollapseWorkbenchPanelMenus", () => {
  test("collapses at 480 px and restores immediately above the boundary", () => {
    expect(shouldCollapseWorkbenchPanelMenus(0)).toBe(false);
    expect(shouldCollapseWorkbenchPanelMenus(480)).toBe(true);
    expect(shouldCollapseWorkbenchPanelMenus(481)).toBe(false);
  });
});

describe("canAttachWorkbenchPanelMenu", () => {
  test("requires room for the menu, resize handle, and Panel content", () => {
    expect(
      canAttachWorkbenchPanelMenu({
        panelWidth: 267,
        targetMenuMinSize: 144,
        attachedMenuMinSizes: [],
      }),
    ).toBe(false);
    expect(
      canAttachWorkbenchPanelMenu({
        panelWidth: 268,
        targetMenuMinSize: 144,
        attachedMenuMinSizes: [],
      }),
    ).toBe(true);
  });

  test("reserves the minimum width of menus that are already attached", () => {
    expect(
      canAttachWorkbenchPanelMenu({
        panelWidth: 415,
        targetMenuMinSize: 144,
        attachedMenuMinSizes: [144],
      }),
    ).toBe(false);
    expect(
      canAttachWorkbenchPanelMenu({
        panelWidth: 416,
        targetMenuMinSize: 144,
        attachedMenuMinSizes: [144],
      }),
    ).toBe(true);
  });
});
