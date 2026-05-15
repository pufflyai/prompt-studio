import {
  type CreateBridgeWebviewHostCapabilities,
  type CreateBridgeWebviewProps,
  createBridgeWebviewRenderer,
} from "pstdio-extensions/shell";
import {
  activateProductModule,
  createShellCore,
  type LayoutPersistenceAdapter,
  type PreferencePersistenceAdapter,
} from "pstdio-shell/core";
import { createDashboardProjectChromeModule } from "./dashboard-project-chrome";
import {
  createDashboardProjectsListMode,
  createDashboardSettingsMode,
  createDashboardShellBaseModule,
  createDashboardWorkspacesMode,
  createProjectNavigationMode,
  createProjectSessionsMode,
  createProjectSettingsMode,
} from "./dashboard-shell-modes";
import {
  createDashboardShellLayoutPersistence,
  createDashboardShellPreferencePersistence,
  type DashboardShellStorage,
} from "./dashboard-shell-persistence";
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
  projectSessions: "project.sessions",
  projectSettings: "project.settings",
} as const;

export type DashboardModeId = (typeof DASHBOARD_MODE_IDS)[keyof typeof DASHBOARD_MODE_IDS];

export type DashboardNavigate = (path: string) => void;

const UNIFIED_SHELL_PERSISTENCE_KEY = "__unified__";

interface CreateDashboardShellInput {
  projectId?: string;
  projectName?: string;
  navigate?: DashboardNavigate;
  storage?: DashboardShellStorage;
  layoutPersistence?: LayoutPersistenceAdapter;
  preferencePersistence?: PreferencePersistenceAdapter;
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
  const shell = createShellCore({
    layoutPersistence:
      input.layoutPersistence ??
      createDashboardShellLayoutPersistence({ projectId: UNIFIED_SHELL_PERSISTENCE_KEY, storage: input.storage }),
    preferencePersistence:
      input.preferencePersistence ??
      createDashboardShellPreferencePersistence({ projectId: UNIFIED_SHELL_PERSISTENCE_KEY, storage: input.storage }),
  });

  let navigateRef: DashboardNavigate = input.navigate ?? (() => {});
  const navigate: DashboardNavigate = (path) => navigateRef(path);

  if (input.projectId) shell.context.set("projectId", input.projectId);
  if (input.projectName) shell.context.set("projectName", input.projectName);

  const baseDisposable = activateProductModule(shell, createDashboardShellBaseModule());
  const projectChromeDisposable = activateProductModule(
    shell,
    createDashboardProjectChromeModule({
      projectId: input.projectId,
      projectName: input.projectName,
      navigate,
      closeOverlay: () => closeOverlayRef(),
      requestCreateTicket: () => requestCreateTicketRef(),
      requestCreateSession: () => requestCreateSessionRef(),
      openCommandPalette: () => (openCommandPaletteRef ?? shell.commandPalette.open)(),
      openCommandPaletteCommands: () => (openCommandPaletteCommandsRef ?? shell.commandPalette.open)(),
      openThemeMenu: () => openThemeMenuRef(),
      openShortcutHelp: () => openShortcutHelpRef(),
    }),
  );
  const ticketsDisposable = activateProductModule(
    shell,
    createDashboardTicketsModule({
      navigate,
      requestCreateTicket: () => requestCreateTicketRef(),
    }),
  );
  const ticketDetailsDisposable = activateProductModule(
    shell,
    createDashboardTicketDetailsModule({
      navigate,
      navigation: ticketDetailsNavigation,
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
    }),
  );
  shell.modes.registerMode(createProjectTicketDetailsMode({ navigation: ticketDetailsNavigation }));
  shell.modes.registerMode(createProjectSessionsMode());
  shell.modes.registerMode(createProjectSettingsMode());

  return {
    ...shell,
    ticketDetailsNavigation,
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
      bridgeRenderer.dispose();
      ticketDetailsDisposable.dispose();
      ticketsDisposable.dispose();
      projectChromeDisposable.dispose();
      baseDisposable.dispose();
    },
  };
};

export type DashboardShell = ReturnType<typeof createDashboardShell>;
