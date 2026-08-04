import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "./dashboard-storage";
import type { DashboardProjectSelectionPersistence } from "./project-selection-persistence";

export interface DashboardSessionSelectionPersistence {
  getSelectedSessionId(): string | undefined;
  setSelectedSessionId(sessionId: string | undefined): void;
}

interface CreateDashboardSessionSelectionPersistenceInput {
  namespace: string;
  storage?: WorkbenchStorageLike;
  projectSelection: Pick<DashboardProjectSelectionPersistence, "getSelectedProjectId">;
}

export const dashboardSessionSelectionStorageKey = (namespace: string, projectId: string) =>
  `${namespace}:selected-session:${projectId}`;

// Which session the Side Panel was last showing, per project. Scoping by project keeps a
// project switch from surfacing a session that belongs to another project.
export const createDashboardSessionSelectionPersistence = (
  input: CreateDashboardSessionSelectionPersistenceInput,
): DashboardSessionSelectionPersistence => {
  const storage = resolveDashboardStorage(input.storage);

  const resolveKey = () => {
    const projectId = input.projectSelection.getSelectedProjectId();
    return projectId ? dashboardSessionSelectionStorageKey(input.namespace, projectId) : undefined;
  };

  return {
    getSelectedSessionId: () => {
      const key = resolveKey();
      if (!key) return undefined;

      const value = storage.getItem(key)?.trim();
      return value && value.length > 0 ? value : undefined;
    },
    setSelectedSessionId: (sessionId) => {
      const key = resolveKey();
      if (!key) return;

      if (!sessionId) {
        storage.removeItem?.(key);
        return;
      }

      storage.setItem(key, sessionId);
    },
  };
};
