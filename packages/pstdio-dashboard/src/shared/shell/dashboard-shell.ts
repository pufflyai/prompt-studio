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

export const DASHBOARD_MODE_IDS = {
  projectsList: "dashboard.projects-list",
  dashboardSettings: "dashboard.settings",
  dashboardWorkspaces: "dashboard.workspaces",
  projectNavigation: "project.navigation",
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
      closeOverlay: input.closeOverlay,
      requestCreateTicket: input.requestCreateTicket,
      requestCreateSession: input.requestCreateSession,
      openCommandPalette: input.openCommandPalette,
      openCommandPaletteCommands: input.openCommandPaletteCommands,
      openThemeMenu: input.openThemeMenu,
      openShortcutHelp: input.openShortcutHelp,
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
  shell.modes.registerMode(createProjectSessionsMode());
  shell.modes.registerMode(createProjectSettingsMode());

  return {
    ...shell,
    setNavigate(next: DashboardNavigate) {
      navigateRef = next;
    },
    dispose: () => {
      shell.modes.setActiveMode(undefined);
      bridgeRenderer.dispose();
      projectChromeDisposable.dispose();
      baseDisposable.dispose();
    },
  };
};

export type DashboardShell = ReturnType<typeof createDashboardShell>;
