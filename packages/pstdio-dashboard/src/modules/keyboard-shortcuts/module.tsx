import type { WorkbenchModuleContribution } from "@pstdio/workbench";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardHelpMenuPath } from "@/shared/app/menu-paths";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { KeyboardShortcutsWidget } from "./components/keyboard-shortcuts-widget";

export const DASHBOARD_HELP_SHORTCUT_KEYBINDING = "Shift+/";

export const createKeyboardShortcutsModule = () =>
  ({
    id: "dashboard.keyboard-shortcuts",
    activate(ctx) {
      ctx.views.registerView({
        id: dashboardWidgetIds.shortcutHelp,
        title: "Keyboard shortcuts",
        body: {
          kind: "react",
          render: (input) => <KeyboardShortcutsWidget input={input} />,
        },
      });
      ctx.overlays.registerOverlay({
        id: dashboardWidgetIds.shortcutHelp,
        viewId: dashboardWidgetIds.shortcutHelp,
        config: { size: "md", placement: "center", scrollBehavior: "inside" },
      });

      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openShortcuts, label: "Keyboard shortcuts", category: "Help", icon: "CircleHelp" },
        {
          execute: () => ctx.overlays.openOverlay(dashboardWidgetIds.shortcutHelp, { title: "Keyboard shortcuts" }),
        },
      );
      ctx.keybindings.registerKeybinding({
        action: { kind: "command", commandId: dashboardCommandIds.openShortcuts },
        keybinding: DASHBOARD_HELP_SHORTCUT_KEYBINDING,
        when: "!inputFocus",
      });
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openShortcuts,
        order: 45,
      });
      ctx.layout.registerMenuItem(dashboardHelpMenuPath, { commandId: dashboardCommandIds.openShortcuts, order: 10 });
    },
  }) satisfies WorkbenchModuleContribution;
