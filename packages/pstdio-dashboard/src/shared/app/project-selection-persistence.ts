import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";

export interface DashboardProjectSelectionPersistence {
  getSelectedProjectId(): string | undefined;
  setSelectedProjectId(projectId: string | undefined): void;
}

interface CreateDashboardProjectSelectionPersistenceInput {
  namespace: string;
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

const resolveStorage = (storage: WorkbenchStorageLike | undefined) => {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStorage();
};

const projectSelectionStorageKey = (namespace: string) => `${namespace}:selected-project:global`;

export const createDashboardProjectSelectionPersistence = (
  input: CreateDashboardProjectSelectionPersistenceInput,
): DashboardProjectSelectionPersistence => {
  const storage = resolveStorage(input.storage);
  const key = projectSelectionStorageKey(input.namespace);

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
