import type { CreateBridgeWebviewHostCapabilities, CreateBridgeWebviewProps } from "pstdio-extensions/shell";
import type {
  LayoutPersistenceAdapter,
  PreferencePersistenceAdapter,
  ShellPanelsPersistenceAdapter,
  TreeViewPersistenceAdapter,
} from "pstdio-shell/core";
import { PROJECT_NAVIGATION_MODE_ID } from "./dashboard-project-navigation";
import { createDashboardShell } from "./dashboard-shell";
import {
  createDashboardShellLayoutPersistence,
  createDashboardShellPanelsPersistence,
  createDashboardShellPreferencePersistence,
  createDashboardShellTreePersistence,
  type DashboardShellStorage,
} from "./dashboard-shell-persistence";

export {
  createDashboardProjectResource,
  PROJECT_NAVIGATION_HEADER_WIDGET_ID,
  PROJECT_NAVIGATION_PARSER_ID,
  PROJECT_NAVIGATOR_ID,
  PROJECT_OPEN_SETTINGS_COMMAND_ID,
  PROJECT_OPEN_SETTINGS_KEYBINDING,
  PROJECT_RESOURCE_KIND,
  PROJECT_SETTINGS_WIDGET_ID,
} from "./dashboard-project-chrome";
export {
  createProjectRouteResource,
  DASHBOARD_COMMAND_RESOURCE_KIND,
  PROJECT_NAVIGATION_FOOTER_TREE_ID,
  PROJECT_NAVIGATION_MODE_ID,
  PROJECT_NAVIGATION_TREE_ID,
  PROJECT_ROUTE_RESOURCE_KIND,
} from "./dashboard-project-navigation";
export {
  DASHBOARD_CHANGE_THEME_COMMAND_ID,
  DASHBOARD_CHANGE_THEME_KEYBINDING,
  DASHBOARD_CLOSE_OVERLAY_COMMAND_ID,
  DASHBOARD_CLOSE_OVERLAY_KEYBINDING,
  DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID,
  DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_COMMAND_ID,
  DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_KEYBINDING,
  DASHBOARD_OPEN_COMMAND_PALETTE_KEYBINDING,
  DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID,
  DASHBOARD_OPEN_SHORTCUT_HELP_KEYBINDING,
  DASHBOARD_PROJECT_SHORTCUTS,
  PROJECT_CREATE_SESSION_COMMAND_ID,
  PROJECT_CREATE_SESSION_KEYBINDING,
  PROJECT_CREATE_TICKET_COMMAND_ID,
  PROJECT_CREATE_TICKET_KEYBINDING,
  PROJECT_GO_TO_TICKETS_COMMAND_ID,
  PROJECT_GO_TO_TICKETS_KEYBINDING,
} from "./dashboard-project-shortcuts";

interface DashboardProjectShellInput {
  projectId: string;
  projectName?: string;
  navigate: (path: string) => void;
  showProjectNavigationTree?: boolean;
  storage?: DashboardShellStorage;
  layoutPersistence?: LayoutPersistenceAdapter;
  preferencePersistence?: PreferencePersistenceAdapter;
  treePersistence?: TreeViewPersistenceAdapter;
  panelsPersistence?: ShellPanelsPersistenceAdapter;
  closeOverlay?: () => void;
  requestCreateTicket?: () => void;
  requestCreateSession?: () => void;
  openCommandPalette?: () => void;
  openCommandPaletteCommands?: () => void;
  openThemeMenu?: () => void;
  openShortcutHelp?: () => void;
  createWebviewHostCapabilities?: CreateBridgeWebviewHostCapabilities;
  createWebviewProps?: CreateBridgeWebviewProps;
}

export const createDashboardProjectShell = (input: DashboardProjectShellInput) => {
  const shell = createDashboardShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
    storage: input.storage,
    layoutPersistence:
      input.layoutPersistence ??
      createDashboardShellLayoutPersistence({ projectId: input.projectId, storage: input.storage }),
    preferencePersistence:
      input.preferencePersistence ??
      createDashboardShellPreferencePersistence({ projectId: input.projectId, storage: input.storage }),
    treePersistence:
      input.treePersistence ??
      createDashboardShellTreePersistence({ projectId: input.projectId, storage: input.storage }),
    panelsPersistence:
      input.panelsPersistence ??
      createDashboardShellPanelsPersistence({ projectId: input.projectId, storage: input.storage }),
    closeOverlay: input.closeOverlay,
    requestCreateTicket: input.requestCreateTicket,
    requestCreateSession: input.requestCreateSession,
    openCommandPalette: input.openCommandPalette,
    openCommandPaletteCommands: input.openCommandPaletteCommands,
    openThemeMenu: input.openThemeMenu,
    openShortcutHelp: input.openShortcutHelp,
    createWebviewHostCapabilities: input.createWebviewHostCapabilities,
    createWebviewProps: input.createWebviewProps,
  });

  if (input.showProjectNavigationTree ?? true) {
    shell.modes.setActiveMode(PROJECT_NAVIGATION_MODE_ID);
  } else {
    shell.layout.clearArea("left-header");
  }

  return shell;
};
