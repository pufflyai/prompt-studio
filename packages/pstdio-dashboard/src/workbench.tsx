import { createWorkbench, type SettingsRegistry, type WorkbenchPageLocationBrowser } from "@pstdio/workbench";
import { createWorkbenchTerminalModule, WORKBENCH_TERMINAL_PANEL_SIZE } from "@pstdio/workbench/react";
import { createLocalStorageWorkbenchPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
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
import type { PerformanceMonitoringController } from "./modules/performance/performance-monitoring-controller";
import { createProjectsModule } from "./modules/projects/module";
import type { DesktopProjectTabs } from "./modules/projects/project-selection-sync";
import { createProjectOpeningModule } from "./modules/projects/setup/module";
import type { ProjectSetupHandoff } from "./modules/projects/setup/project-setup-handoff";
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
  /** Desktop creates hidden workbenches for background tabs. */
  active?: boolean;
  /** The project of a desktop tab. In the browser, the URL or the saved selection decides it. */
  projectId?: string;
  projectTabs?: DesktopProjectTabs;
  setupHandoff?: ProjectSetupHandoff;
  pageLocationBrowser?: WorkbenchPageLocationBrowser;
  performance?: PerformanceMonitoringController;
  storage?: WorkbenchStorageLike;
  layoutDebounceMs?: number;
}

type CreateDashboardModulesInput = {
  initialProjectId?: string;
  performance?: PerformanceMonitoringController;
  projectTabs?: DesktopProjectTabs;
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
  setupHandoff?: ProjectSetupHandoff;
};

export const createDashboardModules = (input: CreateDashboardModulesInput & { settings: SettingsRegistry }) => {
  const projectOpening = createProjectOpeningModule({ handoff: input.setupHandoff });
  return [
    createSidenavModule(),
    createWorkspacesModule(),
    // Warm catalogs can register synchronously; host settings sections must already have their owner.
    createSettingsModule(),
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
    createPerformanceModule(input.settings, input.performance),
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
    // Desktop tabs keep several workbenches; each keeps its own view state and write generations.
    scope: input.projectTabs ? `project/${input.projectId ?? "selection"}` : undefined,
    storage,
    debounceMs: input.layoutDebounceMs,
  });

  const pageLocationBrowser =
    input.pageLocationBrowser ??
    (typeof window === "undefined" ? undefined : createDashboardPageLocationBrowser(window));
  // In the browser the URL decides the project, so shared links and bookmarks open the project they name.
  const urlProjectId = input.projectTabs
    ? undefined
    : pageLocationBrowser && readPageUrlProjectId(pageLocationBrowser.current().url);
  if (urlProjectId) projectSelectionPersistence.setSelectedProjectId(urlProjectId);
  const workbench = createWorkbench({
    active: input.active,
    queries: getDashboardScopedQueries(),
    startPage: dashboardHomePage,
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

  workbench.preferences.registerSchema({
    properties: {
      "dashboard.themePreference": { type: "string", scope: "user" },
      "dashboard.locale": { type: "string", scope: "user" },
    },
  });
  const modules = createDashboardModules({
    settings: workbench.settings,
    initialProjectId: input.projectTabs ? input.projectId : urlProjectId,
    performance: input.performance,
    projectTabs: input.projectTabs,
    setupHandoff: input.setupHandoff,
    projectSelectionPersistence,
  });
  for (const module of modules) workbench.registerModule(module);

  return workbench;
};
