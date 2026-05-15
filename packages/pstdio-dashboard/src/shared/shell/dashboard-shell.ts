import {
  activateProductModule,
  createShellCore,
  type LayoutPersistenceAdapter,
  type PreferencePersistenceAdapter,
} from "pstdio-shell/core";
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
  storage?: DashboardShellStorage;
  layoutPersistence?: LayoutPersistenceAdapter;
  preferencePersistence?: PreferencePersistenceAdapter;
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

  let navigateRef: DashboardNavigate = () => {};
  const navigate: DashboardNavigate = (path) => navigateRef(path);

  const baseDisposable = activateProductModule(shell, createDashboardShellBaseModule());

  shell.modes.registerMode(createDashboardProjectsListMode());
  shell.modes.registerMode(createDashboardSettingsMode({ navigate }));
  shell.modes.registerMode(createDashboardWorkspacesMode());
  shell.modes.registerMode(createProjectNavigationMode());
  shell.modes.registerMode(createProjectSessionsMode());
  shell.modes.registerMode(createProjectSettingsMode());

  return {
    ...shell,
    setNavigate(next: DashboardNavigate) {
      navigateRef = next;
    },
    dispose: () => {
      shell.modes.setActiveMode(undefined);
      baseDisposable.dispose();
    },
  };
};

export type DashboardShell = ReturnType<typeof createDashboardShell>;
