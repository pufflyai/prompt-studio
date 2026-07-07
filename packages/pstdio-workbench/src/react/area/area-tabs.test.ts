import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, workbenchAreaTabLeadingMenuPath } from "../../core";
import { listWorkbenchMenuItems } from "../menus/menu-items";
import { shouldShowAreaTabs } from "./area-tabs";

describe("WorkbenchAreaTabs leading actions", () => {
  test("resolves leading actions from the area tab menu path", () => {
    const workbench = createWorkbenchCore();
    workbench.commands.registerCommand(
      { id: "workbench.terminal.open", label: "Open terminal", icon: "Plus" },
      { execute: () => undefined },
    );
    workbench.layout.registerMenuItem(workbenchAreaTabLeadingMenuPath("secondary"), {
      commandId: "workbench.terminal.open",
      label: "New terminal",
      icon: "Plus",
    });

    expect(listWorkbenchMenuItems(workbench, workbenchAreaTabLeadingMenuPath("secondary"))).toEqual([
      expect.objectContaining({ commandId: "workbench.terminal.open", icon: "Plus", label: "New terminal" }),
    ]);
  });

  test("keeps the tab strip visible when only leading actions remain", () => {
    expect(shouldShowAreaTabs([], { hasLeadingActions: true })).toBe(true);
  });
});
