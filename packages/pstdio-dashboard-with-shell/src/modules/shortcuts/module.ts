import type { ShellModuleContribution } from "pstdio-shell/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-shell/core";
import { createElement } from "react";
import {
  SHORTCUTS_HELP_WIDGET_ID,
  SHORTCUTS_ICON,
  SHORTCUTS_MODULE_ID,
  SHORTCUTS_OPEN_HELP_COMMAND_ID,
  SHORTCUTS_OPEN_HELP_KEYBINDING,
} from "./constants";
import { ShortcutHelpWidget } from "./widgets/shortcut-help-widget";

export * from "./constants";
export type { ShortcutHelpEntry } from "./shortcut-help-model";
export { buildShortcutHelpEntries } from "./shortcut-help-model";

export const createShortcutsModule = (): ShellModuleContribution => ({
  id: SHORTCUTS_MODULE_ID,
  activate(ctx) {
    ctx.layout.registerWidget({
      id: SHORTCUTS_HELP_WIDGET_ID,
      title: "Keyboard shortcuts",
      area: "overlay",
      singleton: true,
      rendererId: SHORTCUTS_HELP_WIDGET_ID,
    });

    ctx.renderers.registerRenderer({
      id: SHORTCUTS_HELP_WIDGET_ID,
      render: (input) => createElement(ShortcutHelpWidget, { input }),
    });

    ctx.commands.registerCommand(
      {
        id: SHORTCUTS_OPEN_HELP_COMMAND_ID,
        label: "Keyboard shortcuts",
        category: "Workbench",
        icon: SHORTCUTS_ICON,
      },
      { execute: () => ctx.layout.openWidget(SHORTCUTS_HELP_WIDGET_ID) },
    );

    ctx.keybindings.registerKeybinding({
      commandId: SHORTCUTS_OPEN_HELP_COMMAND_ID,
      keybinding: SHORTCUTS_OPEN_HELP_KEYBINDING,
    });

    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: SHORTCUTS_OPEN_HELP_COMMAND_ID,
      order: 20,
    });
  },
});
