import type { LastResourcePersistenceAdapter, ResourceRef } from "pstdio-workbench/core";
import type { WorkbenchStorageLike } from "pstdio-workbench/storage";
import type { DashboardProjectSelectionPersistence } from "./project-selection-persistence";

interface CreateDashboardLastResourcePersistenceInput {
  namespace: string;
  storage?: WorkbenchStorageLike;
  projectSelection: Pick<DashboardProjectSelectionPersistence, "getSelectedProjectId">;
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

const resolveStorage = (storage: WorkbenchStorageLike | undefined) => {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStorage();
};

const isResourceRef = (value: unknown): value is ResourceRef =>
  Boolean(value) && typeof (value as ResourceRef).kind === "string" && typeof (value as ResourceRef).uri === "string";

export const dashboardLastResourceStorageKey = (namespace: string, projectId: string) =>
  `${namespace}:last-resource:${projectId}`;

// Persists the last-opened resource per project. Without per-project scoping, switching
// projects (or closing and reopening one) would surface another project's view through
// the workbench's `lastResource` controller.
export const createDashboardLastResourcePersistence = (
  input: CreateDashboardLastResourcePersistenceInput,
): LastResourcePersistenceAdapter => {
  const storage = resolveStorage(input.storage);

  const resolveKey = () => {
    const projectId = input.projectSelection.getSelectedProjectId();
    return projectId ? dashboardLastResourceStorageKey(input.namespace, projectId) : undefined;
  };

  return {
    getLastResource: () => {
      const key = resolveKey();
      if (!key) return undefined;

      const raw = storage.getItem(key);
      if (!raw) return undefined;

      try {
        const parsed = JSON.parse(raw);
        return isResourceRef(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    },
    setLastResource: (resource) => {
      const key = resolveKey();
      if (!key) return;

      if (!resource) {
        storage.removeItem?.(key);
        return;
      }

      storage.setItem(key, JSON.stringify(resource));
    },
  };
};
