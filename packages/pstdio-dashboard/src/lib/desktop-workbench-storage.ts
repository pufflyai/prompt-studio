import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";

export interface DesktopWorkbenchStorageBridge {
  getWorkbenchState: () => Promise<Record<string, string>>;
  setWorkbenchStateItem: (key: string, value: string | null) => Promise<void>;
}

declare global {
  interface Window {
    promptStudioDesktop?: DesktopWorkbenchStorageBridge;
  }
}

export const createDesktopWorkbenchStorage = async (
  bridge: DesktopWorkbenchStorageBridge | undefined,
): Promise<WorkbenchStorageLike | undefined> => {
  if (!bridge) return undefined;
  const values = new Map(Object.entries(await bridge.getWorkbenchState()));

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      void bridge.setWorkbenchStateItem(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
      void bridge.setWorkbenchStateItem(key, null);
    },
  };
};
