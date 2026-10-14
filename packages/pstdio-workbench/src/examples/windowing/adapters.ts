import type { LayoutPersistenceAdapter, WorkbenchLayout, WorkbenchPageLocationPersistence } from "../../core";
import type { PersistedWorkbenchPageLocation } from "../../core/controllers/page-location/page-location-types";

export const createWindowingPersistence = () => {
  const layouts = new Map<string, WorkbenchLayout>();
  const locations = new Map<string, PersistedWorkbenchPageLocation>();
  const layout: LayoutPersistenceAdapter = {
    listScopes: (projectId) => [...layouts.keys()].filter((scope) => scope.startsWith(`project/${projectId}/`)),
    getLayout: (scope = "__global__") => {
      const saved = layouts.get(scope);
      return saved && structuredClone(saved);
    },
    setLayout: (value, scope = "__global__") => {
      // Match stored layouts: live tab callbacks are supplied again by registrations on reload.
      layouts.set(scope, JSON.parse(JSON.stringify(value)));
    },
    transformLayouts(projectId, transform) {
      for (const [scope, value] of layouts) {
        if (!scope.startsWith(`project/${projectId}/`)) continue;
        const next = transform(value, scope);
        if (next) layouts.set(scope, next);
        else layouts.delete(scope);
      }
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
