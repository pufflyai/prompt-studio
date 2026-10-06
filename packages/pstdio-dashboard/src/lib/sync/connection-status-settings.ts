import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";

// Display is a local preference. Live sync and read recovery always stay active.
export const createConnectionStatusSettings = (storage: WorkbenchStorageLike) => {
  const key = "pstdio-dashboard:connection-status";
  const listeners = new Set<() => void>();
  return {
    getEnabled: () => storage.getItem(key) === "true",
    setEnabled: (enabled: boolean) => {
      storage.setItem(key, String(enabled));
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export type ConnectionStatusSettings = ReturnType<typeof createConnectionStatusSettings>;
