import { createWorkbenchCore } from "pstdio-workbench/core";
import {
  createLocalStorageLastResourcePersistence,
  createLocalStoragePanelsPersistence,
  createLocalStorageTreePersistence,
  type WorkbenchStorageLike,
} from "pstdio-workbench/storage";
import { createBootstrapModule } from "./modules/bootstrap";
import { createSessionsModule } from "./modules/sessions/module";
import { createSettingsModule } from "./modules/settings/module";
import { createShellModule } from "./modules/shell/module";
import { createWorkspacesModule } from "./modules/workspaces/module";
import { createDashboardProjectSelectionPersistence } from "./shared/project-selection-persistence";

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

type CreateDashboardExampleModulesInput = {
  projectSelectionPersistence?: ReturnType<typeof createDashboardProjectSelectionPersistence>;
};

export const createDashboardExampleModules = (input: CreateDashboardExampleModulesInput = {}) => [
  createWorkspacesModule(),
  createSessionsModule(),
  createSettingsModule(),
  createShellModule({ projectSelectionPersistence: input.projectSelectionPersistence }),
  createBootstrapModule({ projectSelectionPersistence: input.projectSelectionPersistence }),
];

export const createDashboardWorkbench = (input: CreateDashboardWorkbenchInput = {}) => {
  const storage = resolveDashboardWorkbenchStorage(input.storage);
  const projectSelectionPersistence = createDashboardProjectSelectionPersistence({
    namespace: dashboardWorkbenchStorageNamespace,
    storage,
  });
  const workbench = createWorkbenchCore({
    panelsPersistence: createLocalStoragePanelsPersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      scope: "global",
      storage,
    }),
    treePersistence: createLocalStorageTreePersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
    }),
    lastResourcePersistence: createLocalStorageLastResourcePersistence({
      namespace: dashboardWorkbenchStorageNamespace,
      storage,
    }),
  });
  for (const module of createDashboardExampleModules({ projectSelectionPersistence })) workbench.registerModule(module);
  return workbench;
};
