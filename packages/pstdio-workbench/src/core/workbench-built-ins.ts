import type { WorkbenchShellOpenRegion } from "./controllers/shell/shell-controller";
import type { KeybindingSequence } from "./registries/keybindings/keybinding-registry";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "./workbench-core";

const SIDENAV_PANEL_ID = "sidenav";

const togglePanel = (workbench: WorkbenchCore, region: WorkbenchShellOpenRegion) => {
  workbench.shell.setRegionOpen(region, !workbench.shell.getRegionState(region).open);
};

interface BuiltinCommand {
  id: string;
  label: string;
  icon: string;
  keybinding: KeybindingSequence;
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
    label: "Change Theme",
    icon: "Palette",
    keybinding: "Alt+Shift+T",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ view: "theme" }),
  },
  {
    id: "workbench.action.navigateBack",
    label: "Navigate Back",
    icon: "ArrowLeft",
    keybinding: "Alt+Shift+ArrowLeft",
    execute: (workbench: WorkbenchCore) => {
      workbench.pageLocations.goBack();
    },
  },
  {
    id: "workbench.action.navigateForward",
    label: "Navigate Forward",
    icon: "ArrowRight",
    keybinding: "Alt+Shift+ArrowRight",
    execute: (workbench: WorkbenchCore) => {
      workbench.pageLocations.goForward();
    },
  },
  {
    id: "workbench.toggleSideBar",
    label: "Toggle Sidenav",
    icon: "PanelLeft",
    keybinding: "Mod+B",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, SIDENAV_PANEL_ID),
  },
];

export const registerWorkbenchBuiltIns = (workbench: WorkbenchCore) => {
  const layers: Record<string, { layer: "view" | "go" | "help" | "settings"; keybinding: string; sticky?: boolean }> = {
    "workbench.toggleCommandPalette": { layer: "help", keybinding: "P" },
    "workbench.action.showCommands": { layer: "help", keybinding: "C" },
    "workbench.action.changeTheme": { layer: "settings", keybinding: "T" },
    "workbench.action.navigateBack": { layer: "go", keybinding: "B", sticky: true },
    "workbench.action.navigateForward": { layer: "go", keybinding: "F", sticky: true },
    "workbench.toggleSideBar": { layer: "view", keybinding: "B", sticky: true },
  };
  for (const command of builtinCommands) {
    workbench.commands.registerCommand(
      {
        id: command.id,
        label: command.label,
        category: "Workbench",
        icon: command.icon,
        when: "!inputFocus",
      },
      { execute: () => command.execute(workbench) },
    );
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: command.id },
      keybinding: command.keybinding,
      when: "!inputFocus",
    });
    const layer = layers[command.id];
    if (layer)
      workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: command.id }, ...layer });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: command.id,
      group: "Workbench",
    });
  }
};
