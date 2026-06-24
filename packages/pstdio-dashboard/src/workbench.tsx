import { createWorkbenchCore } from "pstdio-workbench/core";
import { createLocalStorageWorkbenchPersistence, type WorkbenchStorageLike } from "pstdio-workbench/storage";
import { createDashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { createBootstrapModule } from "./modules/bootstrap";
import { createCommandPaletteModule } from "./modules/command-palette/module";
import { createDashboardViewsModule } from "./modules/dashboard-views/module";
import { createExtensionsModule } from "./modules/extensions/module";
import { createHeadersModule } from "./modules/headers/module";
import { createHelpModule } from "./modules/help/module";
import { createKeyboardShortcutsModule } from "./modules/keyboard-shortcuts/module";
import { createProjectsModule } from "./modules/projects/module";
import { createSessionBubbleModule } from "./modules/sessions/bubble/module";
import { createSessionsModule } from "./modules/sessions/module";
import { createSettingsModule } from "./modules/settings/module";
import { createSidebarModule } from "./modules/sidebar/module";
import { createStartModule } from "./modules/start/module";
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
  createSidebarModule(),
  createWorkspacesModule(),
  createExtensionsModule(),
  createProjectsModule({ projectSelectionPersistence: input.projectSelectionPersistence }),
  createHeadersModule(),
  createKeyboardShortcutsModule(),
  createHelpModule(),
  createCommandPaletteModule(),
  createSessionBubbleModule(),
  createSessionsModule(),
  createSettingsModule(),
  createStartModule(),
  createBootstrapModule({ projectSelectionPersistence: input.projectSelectionPersistence }),
];

export const createDashboardWorkbench = (input: CreateDashboardWorkbenchInput = {}) => {
  const storage = resolveDashboardWorkbenchStorage(input.storage);

  const projectSelectionPersistence = createDashboardProjectSelectionPersistence({
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
  });

  const workbench = createWorkbenchCore(
    createLocalStorageWorkbenchPersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
    }),
  );

  for (const module of createDashboardModules({ projectSelectionPersistence })) workbench.registerModule(module);

  return workbench;
};
