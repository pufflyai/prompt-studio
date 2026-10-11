import type { LayoutPersistenceAdapter, WorkbenchLayout, WorkbenchPageLocationPersistence } from "../../core";
import type { PersistedWorkbenchPageLocation } from "../../core/controllers/page-location/page-location-types";

export const createWindowingPersistence = () => {
  const layouts = new Map<string, WorkbenchLayout>();
  const locations = new Map<string, PersistedWorkbenchPageLocation>();
  const layout: LayoutPersistenceAdapter = {
    getLayout: (scope = "__global__") => {
      const saved = layouts.get(scope);
      return saved && structuredClone(saved);
    },
    setLayout: (value, scope = "__global__") => {
      layouts.set(scope, structuredClone(value));
    },
  };
  const pageLocation: WorkbenchPageLocationPersistence = {
    load: (projectId) => {
      const saved = locations.get(projectId);
      return saved && structuredClone(saved);
    },
    save: (projectId, value) => {
      locations.set(projectId, structuredClone(value));
    },
  };
  return { layout, pageLocation };
};
