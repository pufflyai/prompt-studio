import { createShellCore, type LayoutPersistenceAdapter, type PreferencePersistenceAdapter } from "pstdio-shell/core";
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

  for (const modeId of Object.values(DASHBOARD_MODE_IDS)) {
    shell.modes.registerMode({
      id: modeId,
      activate: () => undefined,
    });
  }

  return {
    ...shell,
    dispose: () => {
      shell.modes.setActiveMode(undefined);
    },
  };
};

export type DashboardShell = ReturnType<typeof createDashboardShell>;
