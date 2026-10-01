import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { dashboardWorkbenchStorageNamespace } from "../shared/app/dashboard-workbench-storage-keys";
import { dashboardSessionDraftStorageKey } from "../shared/app/session-draft-persistence";

interface DesktopWorkbenchState {
  values: Record<string, string>;
}

export interface DesktopWorkbenchStorageBridge {
  getWorkbenchState: () => Promise<DesktopWorkbenchState>;
  setWorkbenchItem: (key: string, value: string | null) => Promise<void>;
}

declare global {
  interface Window {
    promptStudioDesktop?: DesktopWorkbenchStorageBridge;
  }
}

// Desktop discards browser storage on quit. Everything the dashboard saves survives a
// restart through Electron, except unsent chat drafts, which stay in the browser session.
const sessionDraftKeyPrefix = dashboardSessionDraftStorageKey(dashboardWorkbenchStorageNamespace, "");
const isDurableKey = (key: string) => !key.startsWith(sessionDraftKeyPrefix);

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
  const durableValues = new Map(Object.entries((await bridge.getWorkbenchState()).values));
  const sessionStorage = resolveBrowserStorage(browserStorage);

  return {
    getItem: (key) => (isDurableKey(key) ? (durableValues.get(key) ?? null) : sessionStorage.getItem(key)),
    setItem: (key, value) => {
      if (!isDurableKey(key)) {
        sessionStorage.setItem(key, value);
        return;
      }
      durableValues.set(key, value);
      void bridge.setWorkbenchItem(key, value);
    },
    removeItem: (key) => {
      if (!isDurableKey(key)) {
        sessionStorage.removeItem?.(key);
        return;
      }
      durableValues.delete(key);
      void bridge.setWorkbenchItem(key, null);
    },
  } satisfies WorkbenchStorageLike;
};
