import { createWorkbenchCore, type LayoutPersistenceAdapter } from "@pstdio/workbench";
import { createWorkbenchTerminalModule } from "@pstdio/workbench/react";
import { createLocalStorageWorkbenchPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardViewPath } from "@/shared/app/browser-location";
import { resolveDashboardStorage } from "@/shared/app/dashboard-storage";
import { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";
import { createDashboardLastResourcePersistence } from "@/shared/app/last-resource-persistence";
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

export { dashboardWorkbenchStorageNamespace } from "@/shared/app/dashboard-workbench-storage-keys";

interface CreateDashboardWorkbenchInput {
  initialViewPath?: string;
  storage?: WorkbenchStorageLike;
}

type CreateDashboardModulesInput = {
  initialViewPath?: string;
  lastResourcePersistence?: ReturnType<typeof createDashboardLastResourcePersistence>;
  layoutPersistence?: LayoutPersistenceAdapter;
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
  sessionDraftPersistence?: DashboardSessionDraftPersistence;
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
};

export const createDashboardModules = (input: CreateDashboardModulesInput = {}) => [
  createSidenavModule(),
  createWorkspacesModule(),
  createExtensionsModule({ layoutPersistence: input.layoutPersistence }),
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
    initialViewPath: input.initialViewPath,
    lastResourcePersistence: input.lastResourcePersistence,
    projectSelectionPersistence: input.projectSelectionPersistence,
    sessionSelectionPersistence: input.sessionSelectionPersistence,
  }),
];

export const createDashboardWorkbench = (input: CreateDashboardWorkbenchInput = {}) => {
  const storage = resolveDashboardStorage(input.storage);
  const initialViewPath =
    input.initialViewPath ??
    (typeof window === "undefined" ? undefined : resolveDashboardViewPath(window.location.pathname));

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

  const lastResourcePersistence = createDashboardLastResourcePersistence(scopedByProject);
  const workbench = createWorkbenchCore({
    initialSidePanelMode: "closed",
    defaultPanelOpenByRegionId: { secondary: false },
    ...persistence,
    lastResourcePersistence,
  });

  const modules = createDashboardModules({
    initialViewPath,
    lastResourcePersistence,
    layoutPersistence: persistence.layoutPersistence,
    projectSelectionPersistence,
    sessionDraftPersistence,
    sessionSelectionPersistence,
  });
  for (const module of modules) workbench.registerModule(module);

  return workbench;
};
