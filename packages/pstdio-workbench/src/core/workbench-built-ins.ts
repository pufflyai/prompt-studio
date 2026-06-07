import type { WorkbenchArea } from "./registries/layout/layout-model";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "./workbench-core";

const LEFT_PANEL_ID = "left";
const MAIN_BOTTOM_PANEL_ID = "secondary";

const setPanelOpen = (workbench: WorkbenchCore, panelId: WorkbenchArea, open: boolean) => {
  workbench.panels.setOpen(panelId, open);
  workbench.layout.setAreaVisible(panelId, open);
};

const togglePanel = (workbench: WorkbenchCore, panelId: WorkbenchArea) => {
  setPanelOpen(workbench, panelId, !workbench.panels.isOpen(panelId));
};

const builtinCommands = [
  {
    id: "workbench.toggleCommandPalette",
    label: "Toggle Command Palette",
    icon: "Command",
    keybinding: "Ctrl+Shift+P",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.toggle(),
  },
  {
    id: "workbench.action.showCommands",
    label: "Run Command",
    icon: "Terminal",
    keybinding: "Ctrl+Shift+.",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ initialQuery: "> " }),
  },
  {
    id: "workbench.action.changeTheme",
    label: "Change Theme",
    icon: "Palette",
    keybinding: "Ctrl+Shift+K",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.open({ view: "theme" }),
  },
  {
    id: "workbench.action.navigateBack",
    label: "Navigate Back",
    icon: "ArrowLeft",
    keybinding: "Ctrl+Shift+[",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goBack();
    },
  },
  {
    id: "workbench.action.navigateForward",
    label: "Navigate Forward",
    icon: "ArrowRight",
    keybinding: "Ctrl+Shift+]",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goForward();
    },
  },
  {
    id: "workbench.toggleSideBar",
    label: "Toggle Sidebar",
    icon: "PanelLeft",
    keybinding: "Ctrl+Shift+B",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, LEFT_PANEL_ID),
  },
  {
    id: "workbench.togglePanel",
    label: "Toggle Panel",
    icon: "PanelBottom",
    keybinding: "Ctrl+Shift+J",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, MAIN_BOTTOM_PANEL_ID),
  },
] as const;

interface WorkbenchSwitchModeCommandArgs {
  modeId: string;
}

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
      id: "workbench.action.switchMode",
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
        if (!workbench.modes.getMode(args.modeId)) throw new Error(`Workbench mode not registered: ${args.modeId}`);
        workbench.modes.setActiveMode(args.modeId);
      },
    },
  );
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "workbench.action.switchMode",
    group: "Workbench",
  });
};
