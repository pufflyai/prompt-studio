import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";

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

// Desktop discards browser storage on quit. Everything the dashboard saves, including
// unsent chat drafts, survives a restart through Electron.
export const createDesktopWorkbenchStorage = async (bridge: DesktopWorkbenchStorageBridge | undefined) => {
  if (!bridge) return undefined;
  const values = new Map(Object.entries((await bridge.getWorkbenchState()).values));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      void bridge.setWorkbenchItem(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
      void bridge.setWorkbenchItem(key, null);
    },
  } satisfies WorkbenchStorageLike;
};
