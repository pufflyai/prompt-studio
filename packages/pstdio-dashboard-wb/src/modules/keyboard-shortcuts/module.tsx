import type { WorkbenchModuleContribution } from "pstdio-workbench/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardHelpMenuPath } from "@/shared/app/menu-paths";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { KeyboardShortcutsWidget } from "./components/keyboard-shortcuts-widget";

export const DASHBOARD_HELP_SHORTCUT_KEYBINDING = "Ctrl+Shift+H";

export const createKeyboardShortcutsModule = () =>
  ({
    id: "dashboard.keyboard-shortcuts",
    activate(ctx) {
      ctx.layout.registerWidget({
        id: dashboardWidgetIds.shortcutHelp,
        title: "Keyboard shortcuts",
        area: "overlay",
        singleton: true,
        closable: true,
        rendererId: dashboardWidgetIds.shortcutHelp,
        config: { size: "md", placement: "center", scrollBehavior: "inside" },
      });
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.shortcutHelp,
        render: (input) => <KeyboardShortcutsWidget input={input} />,
      });

      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openShortcuts, label: "Keyboard shortcuts", category: "Help", icon: "CircleHelp" },
        { execute: () => ctx.layout.openWidget(dashboardWidgetIds.shortcutHelp, { title: "Keyboard shortcuts" }) },
      );
      ctx.keybindings.registerKeybinding({
        commandId: dashboardCommandIds.openShortcuts,
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
