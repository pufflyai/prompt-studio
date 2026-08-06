import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";

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

// The browser store the dashboard persists its own (non-workbench) state in. Tests and
// non-browser hosts pass their own; everything else shares one `localStorage`.
export const resolveDashboardStorage = (storage: WorkbenchStorageLike | undefined) => {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return createMemoryStorage();
};
