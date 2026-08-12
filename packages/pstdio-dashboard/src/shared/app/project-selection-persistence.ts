import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "./dashboard-storage";
import { dashboardProjectSelectionStorageKey } from "./dashboard-workbench-storage-keys";

export interface DashboardProjectSelectionPersistence {
  getSelectedProjectId(): string | undefined;
  setSelectedProjectId(projectId: string | undefined): void;
}

interface CreateDashboardProjectSelectionPersistenceInput {
  namespace: string;
  storage?: WorkbenchStorageLike;
}

export const createDashboardProjectSelectionPersistence = (
  input: CreateDashboardProjectSelectionPersistenceInput,
): DashboardProjectSelectionPersistence => {
  const storage = resolveDashboardStorage(input.storage);
  const key = dashboardProjectSelectionStorageKey(input.namespace);

  return {
    getSelectedProjectId: () => {
      const value = storage.getItem(key)?.trim();
      return value && value.length > 0 ? value : undefined;
    },
    setSelectedProjectId: (projectId) => {
      if (!projectId) {
        storage.removeItem?.(key);
        return;
      }
      storage.setItem(key, projectId);
    },
  };
};
