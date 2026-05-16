import type { WorkbenchArea } from "./registries/layout/layout-model";
import { workbenchCommandPaletteMenuPath } from "./registries/menus/workbench-menu-paths";
import type { WorkbenchCore } from "./workbench-core";

const LEFT_PANEL_ID = "left";
const MAIN_BOTTOM_PANEL_ID = "main-bottom";

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
    keybinding: "mod+k",
    execute: (workbench: WorkbenchCore) => workbench.commandPalette.toggle(),
  },
  {
    id: "workbench.toggleSideBar",
    label: "Toggle Sidebar",
    icon: "PanelLeft",
    keybinding: "mod+b",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, LEFT_PANEL_ID),
  },
  {
    id: "workbench.togglePanel",
    label: "Toggle Panel",
    icon: "PanelBottom",
    keybinding: "mod+j",
    execute: (workbench: WorkbenchCore) => togglePanel(workbench, MAIN_BOTTOM_PANEL_ID),
  },
  {
    id: "workbench.focusMain",
    label: "Focus Main Area",
    icon: "PanelTop",
    keybinding: "alt+1",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("main"),
  },
  {
    id: "workbench.focusSideBar",
    label: "Focus Sidebar",
    icon: "PanelLeft",
    keybinding: "alt+2",
    execute: (workbench: WorkbenchCore) => workbench.focus.setActiveArea("sideBar"),
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
    workbench.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: command.id,
      group: "Workbench",
    });
  }

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
    keybinding: "mod+w",
    when: "!inputFocus && mainFocus || !inputFocus && panelFocus",
  });
  workbench.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
    commandId: "workbench.closeActiveWidget",
    group: "Workbench",
  });
};
