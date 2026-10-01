import type {
  PersistedWorkbenchPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationPersistence,
} from "./page-location-controller";

export const createMemoryWorkbenchPageLocationBrowser = (): WorkbenchPageLocationBrowser => {
  const entries: WorkbenchPageBrowserEntry[] = [{ url: "/" }];
  let index = 0;
  const listeners = new Set<(entry: WorkbenchPageBrowserEntry) => void>();
  const notify = () => {
    for (const listener of listeners) listener(entries[index]!);
  };
  return {
    current: () => entries[index]!,
    push: (entry) => {
      entries.splice(index + 1);
      entries.push(entry);
      index = entries.length - 1;
    },
    replace: (entry) => {
      entries[index] = entry;
    },
    back: () => {
      if (index === 0) return;
      index -= 1;
      notify();
    },
    forward: () => {
      if (index >= entries.length - 1) return;
      index += 1;
      notify();
    },
    onPopState: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
};

export const createMemoryWorkbenchPageLocationPersistence = (): WorkbenchPageLocationPersistence => {
  const locations = new Map<string, PersistedWorkbenchPageLocation>();
  return {
    load: (projectId) => locations.get(projectId),
    save: (projectId, persisted) => locations.set(projectId, persisted),
  };
};
