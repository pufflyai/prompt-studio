import type { LastResourcePersistenceAdapter, ResourceRef } from "@pstdio/workbench";
import { type WorkbenchStorageLike, workbenchStoragePersistenceKey } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "./dashboard-storage";
import type { DashboardProjectSelectionPersistence } from "./project-selection-persistence";

interface CreateDashboardLastResourcePersistenceInput {
  namespace: string;
  storage?: WorkbenchStorageLike;
  projectSelection: Pick<DashboardProjectSelectionPersistence, "getSelectedProjectId">;
}

export interface DashboardLastResourcePersistence extends LastResourcePersistenceAdapter {
  getLegacyViewResource(): ResourceRef | undefined;
  clearLegacyViewResource(): void;
}

const isResourceRef = (value: unknown): value is ResourceRef =>
  Boolean(value) && typeof (value as ResourceRef).kind === "string" && typeof (value as ResourceRef).uri === "string";

export const dashboardLastResourceStorageKey = (namespace: string, projectId: string) =>
  `${namespace}:last-resource:${projectId}`;

const readResource = (storage: WorkbenchStorageLike, key: string) => {
  const raw = storage.getItem(key);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    return isResourceRef(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const isLegacyViewResource = (resource: ResourceRef | undefined) =>
  resource?.kind === "extension-route" || resource?.kind === "extension-view" || resource?.kind === "dashboard-view";

// Persists the last-opened resource per project. Without per-project scoping, switching
// projects (or closing and reopening one) would surface another project's view through
// the workbench's `lastResource` controller.
export const createDashboardLastResourcePersistence = (
  input: CreateDashboardLastResourcePersistenceInput,
): DashboardLastResourcePersistence => {
  const storage = resolveDashboardStorage(input.storage);

  const resolveKey = () => {
    const projectId = input.projectSelection.getSelectedProjectId();
    return projectId ? dashboardLastResourceStorageKey(input.namespace, projectId) : undefined;
  };

  return {
    getLastResource: () => {
      const key = resolveKey();
      if (!key) return undefined;

      const saved = readResource(storage, key);
      if (saved) return isLegacyViewResource(saved) ? undefined : saved;

      const legacyKey = workbenchStoragePersistenceKey(input.namespace, "last-resource", "global");
      const legacyResource = readResource(storage, legacyKey);
      if (!legacyResource) return undefined;

      storage.setItem(key, JSON.stringify(legacyResource));
      storage.removeItem?.(legacyKey);
      return isLegacyViewResource(legacyResource) ? undefined : legacyResource;
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
    getLegacyViewResource: () => {
      const key = resolveKey();
      if (!key) return undefined;
      const resource = readResource(storage, key);
      return isLegacyViewResource(resource) ? resource : undefined;
    },
    clearLegacyViewResource: () => {
      const key = resolveKey();
      if (!key || !isLegacyViewResource(readResource(storage, key))) return;
      storage.removeItem?.(key);
    },
  };
};
