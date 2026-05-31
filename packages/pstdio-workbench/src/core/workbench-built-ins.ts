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
    id: "workbench.action.navigatePrevious",
    label: "Navigate to Previous Location",
    icon: "Undo2",
    keybinding: "Ctrl+Shift+-",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.goPrevious();
    },
  },
  {
    id: "workbench.action.reopenLastClosed",
    label: "Reopen Last Closed",
    icon: "RotateCcw",
    keybinding: "Ctrl+Shift+R",
    execute: (workbench: WorkbenchCore) => {
      workbench.history.reopenLastClosed();
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
  {
    id: "workbench.focusMain",
    label: "Focus Main Area",
    icon: "PanelTop",
    keybinding: "Ctrl+Shift+1",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("main"),
  },
  {
    id: "workbench.focusSideBar",
    label: "Focus Sidebar",
    icon: "PanelLeft",
    keybinding: "Ctrl+Shift+2",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("sideBar"),
  },
  {
    id: "workbench.focusPanel",
    label: "Focus Panel",
    icon: "PanelBottom",
    keybinding: "Ctrl+Shift+3",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("panel"),
  },
] as const;

const closeActiveWidget = (workbench: WorkbenchCore) => {
  const activeWidgetId = workbench.layout.getLayout().activeWidgetId;
  if (!activeWidgetId) return;
  workbench.layout.closeWidget(activeWidgetId);
};

const canCloseActiveWidget = (workbench: WorkbenchCore) => {
  const activeWidgetId = workbench.layout.getLayout().activeWidgetId;
  if (!activeWidgetId) return false;
  for (const area of Object.values(workbench.layout.getLayout().areas)) {
    const placement = area.widgets.find((candidate) => candidate.widgetId === activeWidgetId);
    if (placement) return placement.closable === true;
  }
  return false;
};

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
      execute: (args: WorkbenchSwitchModeCommandArgs) => {
        if (!workbench.modes.getMode(args.modeId)) throw new Error(`Workbench mode not registered: ${args.modeId}`);
        workbench.modes.setActiveMode(args.modeId);
      },
    },
  );
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "workbench.action.switchMode",
    group: "Workbench",
  });

  workbench.commands.registerCommand(
    {
      id: "workbench.closeActiveWidget",
      label: "Close Active Widget",
      category: "Workbench",
      icon: "X",
      when: "!inputFocus",
    },
    {
      execute: () => closeActiveWidget(workbench),
      isEnabled: () => canCloseActiveWidget(workbench),
    },
  );
  workbench.keybindings.registerKeybinding({
    commandId: "workbench.closeActiveWidget",
    keybinding: "Ctrl+Shift+X",
    when: "!inputFocus && mainFocus || !inputFocus && panelFocus",
  });
  workbench.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: "workbench.closeActiveWidget",
    group: "Workbench",
  });
};
