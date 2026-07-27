import { createWorkbenchCore } from "@pstdio/workbench";
import { createWorkbenchTerminalModule } from "@pstdio/workbench/react";
import { createLocalStorageWorkbenchPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { createDashboardLastResourcePersistence } from "@/shared/app/last-resource-persistence";
import { createDashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { createBootstrapModule } from "./modules/bootstrap";
import { createCommandPaletteModule } from "./modules/command-palette/module";
import { createDashboardViewsModule } from "./modules/dashboard-views/module";
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

const dashboardWorkbenchStorageNamespace = "dashboard-wb";

interface CreateDashboardWorkbenchInput {
  storage?: WorkbenchStorageLike;
}

const createMemoryStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const resolveDashboardWorkbenchStorage = (storage: WorkbenchStorageLike | undefined) => {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStorage();
};

type CreateDashboardModulesInput = {
  projectSelectionPersistence?: ReturnType<typeof createDashboardProjectSelectionPersistence>;
};

export const createDashboardModules = (input: CreateDashboardModulesInput = {}) => [
  createDashboardViewsModule(),
  createSidenavModule(),
  createWorkspacesModule(),
  createExtensionsModule(),
  createProjectsModule({ projectSelectionPersistence: input.projectSelectionPersistence }),
  createHeadersModule(),
  createKeyboardShortcutsModule(),
  createHelpModule(),
  createCommandPaletteModule(),
  createSessionBubbleModule(),
  createSessionsModule(),
  createNotificationsModule(),
  createSettingsModule(),
  createStartModule(),
  createWorkbenchTerminalModule(),
  createTerminalModule(),
  createBootstrapModule({ projectSelectionPersistence: input.projectSelectionPersistence }),
];

export const createDashboardWorkbench = (input: CreateDashboardWorkbenchInput = {}) => {
  const storage = resolveDashboardWorkbenchStorage(input.storage);

  const projectSelectionPersistence = createDashboardProjectSelectionPersistence({
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
  });

  const workbench = createWorkbenchCore({
    initialSidePanelMode: "closed",
    defaultPanelOpenByRegionId: { secondary: false },
    ...createLocalStorageWorkbenchPersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
    }),
    lastResourcePersistence: createDashboardLastResourcePersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
      projectSelection: projectSelectionPersistence,
    }),
  });

  for (const module of createDashboardModules({ projectSelectionPersistence })) workbench.registerModule(module);

  return workbench;
};
