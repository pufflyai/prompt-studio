import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, workbenchRegionTabLeadingMenuPath } from "../../core";
import { listWorkbenchMenuItems } from "../menus/menu-items";
import { shouldShowPanelHeader } from "./region-tabs";

describe("WorkbenchRegionTabs leading actions", () => {
  test("resolves leading actions from the region tab menu path", () => {
    const workbench = createWorkbenchCore();
    workbench.commands.registerCommand(
      { id: "workbench.terminal.open", label: "Open terminal", icon: "Plus" },
      { execute: () => undefined },
    );
    workbench.layout.registerMenuItem(workbenchRegionTabLeadingMenuPath("secondary"), {
      commandId: "workbench.terminal.open",
      label: "New terminal",
      icon: "Plus",
    });

    expect(listWorkbenchMenuItems(workbench, workbenchRegionTabLeadingMenuPath("secondary"))).toEqual([
      expect.objectContaining({ commandId: "workbench.terminal.open", icon: "Plus", label: "New terminal" }),
    ]);
  });

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
