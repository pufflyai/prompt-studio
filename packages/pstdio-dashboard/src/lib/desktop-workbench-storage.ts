import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import {
  dashboardLastResourceStorageKey,
  dashboardProjectSelectionStorageKey,
  dashboardWorkbenchStorageNamespace,
  resolveDesktopWorkbenchStorageKey,
} from "../shared/app/dashboard-workbench-storage-keys";

interface DesktopWorkbenchState {
  selectedProjectId?: string;
  lastResources: Record<string, string>;
}

export interface DesktopWorkbenchStorageBridge {
  getWorkbenchState: () => Promise<DesktopWorkbenchState>;
  setLastResource: (projectId: string, value: string | null) => Promise<void>;
  setSelectedProjectId: (projectId: string | null) => Promise<void>;
}

declare global {
  interface Window {
    promptStudioDesktop?: DesktopWorkbenchStorageBridge;
  }
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

const resolveBrowserStorage = (storage: WorkbenchStorageLike | undefined) => {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStorage();
};

export const createDesktopWorkbenchStorage = async (
  bridge: DesktopWorkbenchStorageBridge | undefined,
  browserStorage?: WorkbenchStorageLike,
) => {
  if (!bridge) return undefined;
  const state = await bridge.getWorkbenchState();
  const durableValues = new Map<string, string>();
  if (state.selectedProjectId) {
    durableValues.set(dashboardProjectSelectionStorageKey(dashboardWorkbenchStorageNamespace), state.selectedProjectId);
  }
  for (const [projectId, resource] of Object.entries(state.lastResources)) {
    durableValues.set(dashboardLastResourceStorageKey(dashboardWorkbenchStorageNamespace, projectId), resource);
  }
  const sessionStorage = resolveBrowserStorage(browserStorage);

  return {
    getItem: (key) =>
      resolveDesktopWorkbenchStorageKey(key) ? (durableValues.get(key) ?? null) : sessionStorage.getItem(key),
    setItem: (key, value) => {
      const destination = resolveDesktopWorkbenchStorageKey(key);
      if (!destination) {
        sessionStorage.setItem(key, value);
        return;
      }
      durableValues.set(key, value);
      if (destination.kind === "selected-project") void bridge.setSelectedProjectId(value);
      else void bridge.setLastResource(destination.projectId, value);
    },
    removeItem: (key) => {
      const destination = resolveDesktopWorkbenchStorageKey(key);
      if (!destination) {
        sessionStorage.removeItem?.(key);
        return;
      }
      durableValues.delete(key);
      if (destination.kind === "selected-project") void bridge.setSelectedProjectId(null);
      else void bridge.setLastResource(destination.projectId, null);
    },
  } satisfies WorkbenchStorageLike;
};
