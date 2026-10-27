import type { KeybindingSequence } from "./registries/keybindings/keybinding-registry";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "./workbench-core";

interface BuiltinCommand {
  id: string;
  label: string;
  icon: string;
  keybinding?: KeybindingSequence;
  category?: string;
  execute: (workbench: WorkbenchCore) => void;
}

// Defaults use `Mod` so a single chord works on macOS (Cmd), Windows, and
// Linux (Ctrl). The command palette intentionally claims the browser print
// chord. Other built-ins must avoid the reserved table in `pstdio-extensions`.
const builtinCommands: BuiltinCommand[] = [
  {
    id: "workbench.toggleCommandPalette",
    label: "Toggle Command Palette",
    icon: "Command",
    keybinding: "Mod+P",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.toggle(),
  },
  {
    id: "workbench.action.showCommands",
    label: "Run Command",
    icon: "Terminal",
    keybinding: "Alt+Shift+K",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ initialQuery: "> " }),
  },
  {
    id: "workbench.action.changeTheme",
    label: "Choose color theme",
    icon: "Palette",
    keybinding: "Alt+Shift+T",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ view: "theme" }),
  },
  {
    id: "workbench.action.navigateBack",
    label: "Go back",
    icon: "ArrowLeft",
    keybinding: "Alt+Shift+ArrowLeft",
    category: "Navigation",
    execute: (workbench: WorkbenchCore) => {
      workbench.pageLocations.goBack();
    },
  },
  {
    id: "workbench.action.navigateForward",
    label: "Go forward",
    icon: "ArrowRight",
    keybinding: "Alt+Shift+ArrowRight",
    category: "Navigation",
    execute: (workbench: WorkbenchCore) => {
      workbench.pageLocations.goForward();
    },
  },
];

export const registerWorkbenchBuiltIns = (workbench: WorkbenchCore) => {
  for (const command of builtinCommands) {
    workbench.commands.registerCommand(
      {
        id: command.id,
        label: command.label,
        category: command.category ?? "Workbench",
        icon: command.icon,
        when: "!inputFocus",
      },
      { execute: () => command.execute(workbench) },
    );
    if (command.keybinding)
      workbench.keybindings.registerKeybinding({
        action: { kind: "command", commandId: command.id },
        keybinding: command.keybinding,
        when: "!inputFocus",
      });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: command.id,
      group: "Workbench",
    });
  }
  registerModeNavigationShortcuts(workbench);
};

import { registerModeNavigationShortcuts } from "./controllers/page-location/mode-navigation-shortcuts";
