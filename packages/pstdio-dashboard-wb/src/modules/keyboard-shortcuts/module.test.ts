import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/commands";
import { dashboardHelpMenuPath } from "../../shared/menu-paths";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { createKeyboardShortcutsModule, DASHBOARD_HELP_SHORTCUT_KEYBINDING } from "./module";

const createKeyboardShortcutsWorkbench = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createKeyboardShortcutsModule());
  return workbench;
};

describe("dashboard keyboard shortcuts module", () => {
  test("shows the dashboard keyboard shortcut on the help menu shortcut action", () => {
    const workbench = createKeyboardShortcutsWorkbench();

    expect(workbench.layout.listMenuItems(dashboardHelpMenuPath).map((item) => item.commandId)).toEqual([
      dashboardCommandIds.openShortcuts,
    ]);
    expect(workbench.keybindings.listKeybindings()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: dashboardCommandIds.openShortcuts,
          keybinding: DASHBOARD_HELP_SHORTCUT_KEYBINDING,
        }),
      ]),
    );
  });

  test("opens shortcut help in the workbench overlay", async () => {
    const workbench = createKeyboardShortcutsWorkbench();

    await workbench.commands.executeCommand(dashboardCommandIds.openShortcuts);

    expect(workbench.commandPalette.isOpen()).toBe(false);
    expect(workbench.layout.getLayout().areas.overlay.widgets).toEqual([
      expect.objectContaining({ contributionId: dashboardWidgetIds.shortcutHelp }),
    ]);
  });
});
