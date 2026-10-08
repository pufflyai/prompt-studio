import { createWorkbench, type WorkbenchPageLocationBrowser } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, WORKBENCH_TERMINAL_PANEL_SIZE } from "@pstdio/workbench/react";
import { createLocalStorageWorkbenchPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";
import { createDashboardPageLocationBrowser, readPageUrlProjectId } from "@/shared/app/page-location-browser";
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
import { createPerformanceModule } from "./modules/performance/module";
import type { DesktopProjectTabsController } from "./modules/projects/desktop-project-tabs-controller";
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
  projectTabs?: DesktopProjectTabsController;
  pageLocationBrowser?: WorkbenchPageLocationBrowser;
  storage?: WorkbenchStorageLike;
  layoutDebounceMs?: number;
}

type CreateDashboardModulesInput = {
  initialProjectId?: string;
  projectTabs?: DesktopProjectTabsController;
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
};

export const createDashboardModules = (input: CreateDashboardModulesInput = {}) => [
  createSidenavModule(),
  createWorkspacesModule(),
  createExtensionsModule(),
  createProjectsModule({
    initialProjectId: input.initialProjectId,
    projectSelectionPersistence: input.projectSelectionPersistence,
    projectTabs: input.projectTabs,
  }),
  createHeadersModule(input.projectTabs),
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
  createPerformanceModule(),
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
    debounceMs: input.layoutDebounceMs,
  });

  const pageLocationBrowser =
    input.pageLocationBrowser ??
    (typeof window === "undefined" ? undefined : createDashboardPageLocationBrowser(window));
  // The URL decides the project, so shared links and bookmarks open the project they name.
  const urlProjectId = pageLocationBrowser && readPageUrlProjectId(pageLocationBrowser.current().url);
  if (urlProjectId) projectSelectionPersistence.setSelectedProjectId(urlProjectId);
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
    initialProjectId: urlProjectId,
    projectTabs: input.projectTabs,
    projectSelectionPersistence,
    sessionDraftPersistence,
    sessionSelectionPersistence,
  });
  for (const module of modules) workbench.registerModule(module);

  return workbench;
};
