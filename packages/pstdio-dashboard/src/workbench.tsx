import { createWorkbench, type WorkbenchPageLocationBrowser } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, WORKBENCH_TERMINAL_PANEL_SIZE } from "@pstdio/workbench/react";
import { createLocalStorageWorkbenchPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";
import { createDashboardPageLocationBrowser } from "@/shared/app/page-location-browser";
import {
  createDashboardProjectSelectionPersistence,
  type DashboardProjectSelectionPersistence,
} from "@/shared/app/project-selection-persistence";
import {
  createDashboardSessionDraftPersistence,
  type DashboardSessionDraftPersistence,
} from "@/shared/app/session-draft-persistence";
import {
  createDashboardSessionSelectionPersistence,
  type DashboardSessionSelectionPersistence,
} from "@/shared/app/session-selection-persistence";
import { createBootstrapModule } from "./modules/bootstrap";
import { createCommandPaletteModule } from "./modules/command-palette/module";
import { createExtensionsModule } from "./modules/extensions/module";
import { createHeadersModule } from "./modules/headers/module";
import { createHelpModule } from "./modules/help/module";
import { createKeyboardShortcutsModule } from "./modules/keyboard-shortcuts/module";
import { createNotificationsModule } from "./modules/notifications/module";
import { createProjectsModule } from "./modules/projects/module";
import { createSessionBubbleModule } from "./modules/sessions/bubble/module";
import { createSessionsModule } from "./modules/sessions/module";
import { createSettingsModule } from "./modules/settings/module";
import { createSidenavModule } from "./modules/sidenav/module";
import { createStartModule } from "./modules/start/module";
import { createTerminalModule } from "./modules/terminal/module";
import { createWorkspacesModule } from "./modules/workspaces/module";
import { resolveDashboardPersistenceScope } from "./shared/workbench/dashboard-persistence-scope";
import { DASHBOARD_SIDENAV_REGION_SIZE } from "./shared/workbench/dashboard-sidenav";

export { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";

interface CreateDashboardWorkbenchInput {
  pageLocationBrowser?: WorkbenchPageLocationBrowser;
  storage?: WorkbenchStorageLike;
}

type CreateDashboardModulesInput = {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
};

export const createDashboardModules = (input: CreateDashboardModulesInput = {}) => [
  createSidenavModule(),
  createWorkspacesModule(),
  createExtensionsModule(),
  createProjectsModule({ projectSelectionPersistence: input.projectSelectionPersistence }),
  createHeadersModule(),
  createKeyboardShortcutsModule(),
  createHelpModule(),
  createCommandPaletteModule(),
  createSessionBubbleModule({ sessionDraftPersistence: input.sessionDraftPersistence }),
  createSessionsModule({
    sessionDraftPersistence: input.sessionDraftPersistence,
    sessionSelectionPersistence: input.sessionSelectionPersistence,
  }),
  createNotificationsModule(),
  createSettingsModule(),
  createStartModule(),
  createWorkbenchTerminalModule(),
  createTerminalModule(),
  createBootstrapModule({
    projectSelectionPersistence: input.projectSelectionPersistence,
    sessionSelectionPersistence: input.sessionSelectionPersistence,
  }),
];

export const createDashboardWorkbench = (input: CreateDashboardWorkbenchInput = {}) => {
  const storage = resolveDashboardStorage(input.storage);
  const projectSelectionPersistence = createDashboardProjectSelectionPersistence({
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
  });
  const scopedByProject = {
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
    projectSelection: projectSelectionPersistence,
  };
  const sessionSelectionPersistence = createDashboardSessionSelectionPersistence(scopedByProject);
  const sessionDraftPersistence = createDashboardSessionDraftPersistence(scopedByProject);

  const persistence = createLocalStorageWorkbenchPersistence({
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
  });

  const pageLocationBrowser =
    input.pageLocationBrowser ??
    (typeof window === "undefined" ? undefined : createDashboardPageLocationBrowser(window));
  const workbench = createWorkbench({
    initialSidePanelMode: "closed",
    defaultPanelOpenByRegionId: { secondary: false },
    regionSettings: {
      secondary: { size: WORKBENCH_TERMINAL_PANEL_SIZE },
      sidenav: { size: DASHBOARD_SIDENAV_REGION_SIZE },
    },
    resolvePagePersistenceScope: resolveDashboardPersistenceScope,
    ...persistence,
    ...(pageLocationBrowser ? { pageLocationBrowser } : {}),
  });

  const modules = createDashboardModules({
    projectSelectionPersistence,
    sessionDraftPersistence,
    sessionSelectionPersistence,
  });
  for (const module of modules) workbench.registerModule(module);

  return workbench;
};
