import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";

export interface DashboardSessionSelectionPersistence {
  getSelectedSessionId(projectId: string): string | undefined;
  setSelectedSessionId(projectId: string, sessionId: string | undefined): void;
}

interface CreateDashboardSessionSelectionPersistenceInput {
  namespace: string;
  storage: WorkbenchStorageLike;
}

export const dashboardSessionSelectionStorageKey = (namespace: string, projectId: string) =>
  `${namespace}:selected-session:${projectId}`;

export const createDashboardSessionSelectionPersistence = (
  input: CreateDashboardSessionSelectionPersistenceInput,
): DashboardSessionSelectionPersistence => ({
  getSelectedSessionId: (projectId) => {
    const sessionId = input.storage.getItem(dashboardSessionSelectionStorageKey(input.namespace, projectId))?.trim();
    return sessionId || undefined;
  },
  setSelectedSessionId: (projectId, sessionId) => {
    const key = dashboardSessionSelectionStorageKey(input.namespace, projectId);
    if (!sessionId) {
      input.storage.removeItem?.(key);
      return;
    }
    input.storage.setItem(key, sessionId);
  },
});
