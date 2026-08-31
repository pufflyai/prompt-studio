import type { PageLocation } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageBrowserEntry,
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationPersistence,
} from "./page-location-controller";

export const createMemoryWorkbenchPageLocationBrowser = (): WorkbenchPageLocationBrowser => {
  let current: WorkbenchPageBrowserEntry = { url: "/" };
  const listeners = new Set<(entry: WorkbenchPageBrowserEntry) => void>();
  return {
    current: () => current,
    push: (entry) => {
      current = entry;
    },
    replace: (entry) => {
      current = entry;
    },
    onPopState: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
};

export const createMemoryWorkbenchPageLocationPersistence = (): WorkbenchPageLocationPersistence => {
  const locations = new Map<string, PageLocation>();
  return {
    load: (projectId) => locations.get(projectId),
    save: (projectId, location) => locations.set(projectId, location),
  };
};
