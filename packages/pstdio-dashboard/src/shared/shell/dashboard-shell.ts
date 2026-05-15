import type { CommandExecuteRequest, DashboardExtensionMetadata } from "pstdio-api-contracts";
import {
  type CreateBridgeWebviewHostCapabilities,
  type CreateBridgeWebviewProps,
  createBridgeWebviewRenderer,
} from "pstdio-extensions/shell";
import {
  createShellCore,
  type LayoutPersistenceAdapter,
  type PreferencePersistenceAdapter,
  type ShellPanelsPersistenceAdapter,
  type TreeViewPersistenceAdapter,
} from "pstdio-shell/core";
import {
  createDashboardExtensionHostModule,
  createDashboardExtensionModules,
  createDashboardExtensionNavigationState,
  dashboardExtensionModuleId,
  EXTENSION_ROUTE_RESOURCE_KIND,
} from "./dashboard-extension-modules";
import { createDashboardProjectChromeModule } from "./dashboard-project-chrome";
import {
  createDashboardProjectsListMode,
  createDashboardSettingsMode,
  createDashboardShellBaseModule,
  createDashboardWorkspacesMode,
  createProjectNavigationMode,
  createProjectSettingsMode,
} from "./dashboard-shell-modes";
import {
  createDashboardShellLayoutPersistence,
  createDashboardShellPanelsPersistence,
  createDashboardShellPreferencePersistence,
  createDashboardShellTreePersistence,
  type DashboardShellStorage,
} from "./dashboard-shell-persistence";
import {
  createDashboardSessionsModule,
  createEmptySessionsNavigationState,
  createProjectSessionsMode,
  PROJECT_SESSIONS_MODE_ID,
} from "./sessions/dashboard-sessions-module";
import {
  createDashboardTicketDetailsModule,
  createEmptyTicketDetailsNavigationState,
  createProjectTicketDetailsMode,
  PROJECT_TICKET_DETAILS_MODE_ID,
} from "./ticket-details/dashboard-ticket-details-module";
import { createDashboardTicketsModule } from "./tickets/dashboard-tickets-module";

export const DASHBOARD_MODE_IDS = {
  projectsList: "dashboard.projects-list",
  dashboardSettings: "dashboard.settings",
  dashboardWorkspaces: "dashboard.workspaces",
  projectNavigation: "project.navigation",
  projectTicketDetails: PROJECT_TICKET_DETAILS_MODE_ID,
  projectSessions: PROJECT_SESSIONS_MODE_ID,
  projectSettings: "project.settings",
} as const;

export type DashboardModeId = (typeof DASHBOARD_MODE_IDS)[keyof typeof DASHBOARD_MODE_IDS];

export type DashboardNavigate = (path: string) => void;

const UNIFIED_SHELL_PERSISTENCE_KEY = "__unified__";

export { dashboardExtensionModuleId, EXTENSION_ROUTE_RESOURCE_KIND };

interface SyncDashboardExtensionModulesInput {
  executeCommand(input: { commandId: string; body: CommandExecuteRequest }): Promise<unknown>;
  metadata: DashboardExtensionMetadata;
  projectId: string;
  resolveAssetUrl(path: string): string;
}

interface CreateDashboardShellInput {
  projectId?: string;
  projectName?: string;
  navigate?: DashboardNavigate;
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

export const createDashboardShell = (input: CreateDashboardShellInput = {}) => {
  let requestCreateTicketRef = input.requestCreateTicket ?? (() => {});
  let requestCreateSessionRef = input.requestCreateSession ?? (() => {});
  let closeOverlayRef = input.closeOverlay ?? (() => {});
  let openCommandPaletteRef: (() => void) | undefined = input.openCommandPalette;
  let openCommandPaletteCommandsRef: (() => void) | undefined = input.openCommandPaletteCommands;
  let openThemeMenuRef = input.openThemeMenu ?? (() => {});
  let openShortcutHelpRef = input.openShortcutHelp ?? (() => {});
  const ticketDetailsNavigation = { current: createEmptyTicketDetailsNavigationState() };
  const sessionsNavigation = { current: createEmptySessionsNavigationState() };
  const extensionNavigation = createDashboardExtensionNavigationState();
  const activeExtensionModuleIds = new Set<string>();
  const shell = createShellCore({
    layoutPersistence:
      input.layoutPersistence ??
      createDashboardShellLayoutPersistence({ projectId: UNIFIED_SHELL_PERSISTENCE_KEY, storage: input.storage }),
    preferencePersistence:
      input.preferencePersistence ??
      createDashboardShellPreferencePersistence({ projectId: UNIFIED_SHELL_PERSISTENCE_KEY, storage: input.storage }),
    treePersistence:
      input.treePersistence ??
      createDashboardShellTreePersistence({ projectId: UNIFIED_SHELL_PERSISTENCE_KEY, storage: input.storage }),
    panelsPersistence:
      input.panelsPersistence ??
      createDashboardShellPanelsPersistence({ projectId: UNIFIED_SHELL_PERSISTENCE_KEY, storage: input.storage }),
  });

  let navigateRef: DashboardNavigate = input.navigate ?? (() => {});
  const navigate: DashboardNavigate = (path) => navigateRef(path);

  if (input.projectId) shell.context.set("projectId", input.projectId);
  if (input.projectName) shell.context.set("projectName", input.projectName);

  const baseDisposable = shell.registerModule(createDashboardShellBaseModule());
  const extensionHostDisposable = shell.registerModule(createDashboardExtensionHostModule({ navigate }));
  const projectChromeDisposable = shell.registerModule(
    createDashboardProjectChromeModule({
      projectId: input.projectId,
      projectName: input.projectName,
      navigate,
      getExtensionNavigationNodes: (projectId) => extensionNavigation.listProjectSidebarNodes(projectId),
      closeOverlay: () => closeOverlayRef(),
      requestCreateTicket: () => requestCreateTicketRef(),
      requestCreateSession: () => requestCreateSessionRef(),
      openCommandPalette: () => (openCommandPaletteRef ?? shell.commandPalette.open)(),
      openCommandPaletteCommands: () => (openCommandPaletteCommandsRef ?? shell.commandPalette.open)(),
      openThemeMenu: () => openThemeMenuRef(),
      openShortcutHelp: () => openShortcutHelpRef(),
    }),
  );
  const ticketsDisposable = shell.registerModule(
    createDashboardTicketsModule({
      navigate,
      requestCreateTicket: () => requestCreateTicketRef(),
    }),
  );
  const ticketDetailsDisposable = shell.registerModule(
    createDashboardTicketDetailsModule({
      navigate,
      navigation: ticketDetailsNavigation,
    }),
  );
  const sessionsDisposable = shell.registerModule(
    createDashboardSessionsModule({
      navigate,
    }),
  );
  const bridgeRenderer = shell.renderers.registerRenderer(
    createBridgeWebviewRenderer({
      createHostCapabilities: input.createWebviewHostCapabilities,
      createProps: input.createWebviewProps,
    }),
  );

  shell.modes.registerMode(createDashboardProjectsListMode());
  shell.modes.registerMode(createDashboardSettingsMode({ navigate }));
  shell.modes.registerMode(createDashboardWorkspacesMode());
  shell.modes.registerMode(
    createProjectNavigationMode({
      projectId: input.projectId,
      projectName: input.projectName,
      navigate,
      getExtensionNavigationNodes: (projectId) => extensionNavigation.listProjectSidebarNodes(projectId),
    }),
  );
  shell.modes.registerMode(createProjectTicketDetailsMode({ navigation: ticketDetailsNavigation }));
  shell.modes.registerMode(createProjectSessionsMode({ navigation: sessionsNavigation }));
  shell.modes.registerMode(createProjectSettingsMode());

  return {
    ...shell,
    ticketDetailsNavigation,
    sessionsNavigation,
    clearExtensionModules() {
      for (const moduleId of activeExtensionModuleIds) shell.unregisterModule(moduleId);
      activeExtensionModuleIds.clear();
    },
    syncExtensionModules(next: SyncDashboardExtensionModulesInput) {
      for (const moduleId of activeExtensionModuleIds) shell.unregisterModule(moduleId);
      activeExtensionModuleIds.clear();

      for (const module of createDashboardExtensionModules({
        executeCommand: next.executeCommand,
        metadata: next.metadata,
        navigation: extensionNavigation,
        projectId: next.projectId,
        resolveAssetUrl: next.resolveAssetUrl,
      })) {
        shell.registerModule(module);
        activeExtensionModuleIds.add(module.id);
      }
    },
    setNavigate(next: DashboardNavigate) {
      navigateRef = next;
    },
    setProjectActions(next: {
      closeOverlay?: () => void;
      requestCreateTicket?: () => void;
      requestCreateSession?: () => void;
      openCommandPalette?: () => void;
      openCommandPaletteCommands?: () => void;
      openThemeMenu?: () => void;
      openShortcutHelp?: () => void;
    }) {
      if (next.closeOverlay) closeOverlayRef = next.closeOverlay;
      if (next.requestCreateTicket) requestCreateTicketRef = next.requestCreateTicket;
      if (next.requestCreateSession) requestCreateSessionRef = next.requestCreateSession;
      if (next.openCommandPalette) openCommandPaletteRef = next.openCommandPalette;
      if (next.openCommandPaletteCommands) openCommandPaletteCommandsRef = next.openCommandPaletteCommands;
      if (next.openThemeMenu) openThemeMenuRef = next.openThemeMenu;
      if (next.openShortcutHelp) openShortcutHelpRef = next.openShortcutHelp;
    },
    dispose: () => {
      shell.modes.setActiveMode(undefined);
      for (const moduleId of activeExtensionModuleIds) shell.unregisterModule(moduleId);
      activeExtensionModuleIds.clear();
      bridgeRenderer.dispose();
      sessionsDisposable.dispose();
      ticketDetailsDisposable.dispose();
      ticketsDisposable.dispose();
      projectChromeDisposable.dispose();
      extensionHostDisposable.dispose();
      baseDisposable.dispose();
    },
  };
};

export type DashboardShell = ReturnType<typeof createDashboardShell>;
