import type { KeybindingSequence } from "./registries/keybindings/keybinding-registry";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import type { NavigationTarget } from "./registries/navigation/navigation-registry";
import type { WorkbenchCore } from "./workbench-core";

const SIDENAV_PANEL_ID = "sidenav";

const setPanelOpen = (workbench: WorkbenchCore, panelId: WorkbenchRegion, open: boolean) => {
  workbench.panels.setOpen(panelId, open);
  workbench.layout.setRegionVisible(panelId, open);
};

const togglePanel = (workbench: WorkbenchCore, panelId: WorkbenchRegion) => {
  setPanelOpen(workbench, panelId, !workbench.panels.isOpen(panelId));
};

interface BuiltinCommand {
  id: string;
  label: string;
  icon: string;
  keybinding: KeybindingSequence;
  execute: (workbench: WorkbenchCore) => void;
}

// Defaults use `Mod` so a single chord works on macOS (Cmd), Windows, and
// Linux (Ctrl). Chords listed here must not clash with browser, OS, or
// developer-tool shortcuts — see `findReservedKeybindingConflict` in
// `pstdio-extensions` for the reserved table.
const builtinCommands: BuiltinCommand[] = [
  {
    id: "workbench.toggleCommandPalette",
    label: "Toggle Command Palette",
    icon: "Command",
    keybinding: "Mod+K",
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
      workbench.history.goBack();
    },
  },
  {
    id: "workbench.action.navigateForward",
    label: "Navigate Forward",
    icon: "ArrowRight",
    keybinding: "Alt+Shift+ArrowRight",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goForward();
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

interface WorkbenchSwitchModeCommandArgs {
  modeId: string;
}

export const workbenchSwitchModeCommandId = "workbench.action.switchMode";

export const getSwitchModeNavigationTargetModeId = (target: NavigationTarget) => {
  if (target.kind !== "command" || target.commandId !== workbenchSwitchModeCommandId) return;
  if (!target.args || typeof target.args !== "object") return;

  const modeId = "modeId" in target.args ? target.args.modeId : undefined;
  return typeof modeId === "string" && modeId.trim().length > 0 ? modeId : undefined;
};

export const registerWorkbenchBuiltIns = (workbench: WorkbenchCore) => {
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
      commandId: command.id,
      keybinding: command.keybinding,
      when: "!inputFocus",
    });
    workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: command.id,
      group: "Workbench",
    });
  }

  workbench.commands.registerCommand(
    {
      id: workbenchSwitchModeCommandId,
      label: "Switch Mode",
      category: "Workbench",
      icon: "PanelTop",
      when: "!inputFocus",
    },
    {
      execute: (args?: WorkbenchSwitchModeCommandArgs) => {
        if (!args?.modeId) {
          workbench.commandPalette.open({ view: "mode" });
          return;
        }
        if (!workbench.modes.getMode(args.modeId)) {
          workbench.notifications.show({
            level: "error",
            title: "Mode unavailable",
            message: `Workbench mode not registered: ${args.modeId}`,
          });
          return;
        }
        workbench.modes.setActiveMode(args.modeId);
      },
    },
  );
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: workbenchSwitchModeCommandId,
    group: "Workbench",
  });
};
