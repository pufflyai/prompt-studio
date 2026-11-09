import {
  createWorkbench,
  type SettingsRegistry,
  type WorkbenchPageLocationBrowser,
  type WorkbenchWindowHost,
} from "@pstdio/workbench";
import { createWorkbenchTerminalModule, WORKBENCH_TERMINAL_PANEL_SIZE } from "@pstdio/workbench/react";
import { createLocalStorageWorkbenchPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";
import { createDashboardPageLocationBrowser, readPageUrlProjectId } from "@/shared/app/page-location-browser";
import {
  createDashboardProjectSelectionPersistence,
  type DashboardProjectSelectionPersistence,
} from "@/shared/app/project-selection-persistence";
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
import { createProjectOpeningModule } from "./modules/projects/setup/module";
import { createRecentResourcesModule } from "./modules/recent-resources/module";
import { createResourceLinksModule } from "./modules/resource-links/module";
import { createSessionsModule } from "./modules/sessions/module";
import { createSettingsModule } from "./modules/settings/module";
import { createSidenavModule } from "./modules/sidenav/module";
import { createTerminalModule } from "./modules/terminal/module";
import { createUpdatesModule } from "./modules/updates/module";
import { createWorkspacesModule } from "./modules/workspaces/module";
import { dashboardHomePage } from "./shared/app/resources";
import { resolveDashboardPersistenceScope } from "./shared/workbench/dashboard-persistence-scope";
import { DASHBOARD_SIDENAV_REGION_SIZE } from "./shared/workbench/dashboard-sidenav";

export { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";

interface CreateDashboardWorkbenchInput {
  projectTabs?: DesktopProjectTabsController;
  pageLocationBrowser?: WorkbenchPageLocationBrowser;
  storage?: WorkbenchStorageLike;
  layoutDebounceMs?: number;
  windows?: WorkbenchWindowHost;
  /** PS-1128 prototype: a window opened for one tab has no Sidenav and starts with its panels closed. */
  secondaryWindow?: boolean;
}

type CreateDashboardModulesInput = {
  initialProjectId?: string;
  projectTabs?: DesktopProjectTabsController;
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
};

export const createDashboardModules = (input: CreateDashboardModulesInput & { settings: SettingsRegistry }) => {
  const projectOpening = createProjectOpeningModule();
  return [
    createSidenavModule(),
    createWorkspacesModule(),
    createExtensionsModule(),
    createResourceLinksModule(),
    createRecentResourcesModule(),
    createProjectsModule({
      onProjectOpening: projectOpening.open,
      initialProjectId: input.initialProjectId,
      projectSelectionPersistence: input.projectSelectionPersistence,
      projectTabs: input.projectTabs,
    }),
    createHeadersModule(input.projectTabs),
    createKeyboardShortcutsModule(),
    createHelpModule(),
    createCommandPaletteModule(),
    createSessionsModule(),
    createNotificationsModule(),
    createSettingsModule(),
    createPerformanceModule(input.settings),
    createUpdatesModule(),
    createWorkbenchTerminalModule(),
    createTerminalModule(),
    projectOpening.module,
    createBootstrapModule({
      projectSelectionPersistence: input.projectSelectionPersistence,
    }),
  ];
};

export const createDashboardWorkbench = (input: CreateDashboardWorkbenchInput = {}) => {
  const storage = resolveDashboardStorage(input.storage);
  const projectSelectionPersistence = createDashboardProjectSelectionPersistence({
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
  });
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
    startPage: dashboardHomePage,
    initialSidePanelMode: "closed",
    defaultPanelOpenByRegionId: { secondary: false, ...(input.secondaryWindow ? { sidenav: false } : {}) },
    regionSettings: {
      secondary: { size: WORKBENCH_TERMINAL_PANEL_SIZE },
      sidenav: { size: DASHBOARD_SIDENAV_REGION_SIZE, ...(input.secondaryWindow ? { canOpen: false } : {}) },
    },
    resolvePagePersistenceScope: resolveDashboardPersistenceScope,
    ...persistence,
    ...(pageLocationBrowser ? { pageLocationBrowser } : {}),
    ...(input.windows ? { windows: input.windows } : {}),
  });

  workbench.preferences.registerSchema({
    properties: {
      "dashboard.themePreference": { type: "string", scope: "user" },
      "dashboard.locale": { type: "string", scope: "user" },
    },
  });
  const modules = createDashboardModules({
    settings: workbench.settings,
    initialProjectId: urlProjectId,
    projectTabs: input.projectTabs,
    projectSelectionPersistence,
  });
  for (const module of modules) workbench.registerModule(module);

  return workbench;
};
