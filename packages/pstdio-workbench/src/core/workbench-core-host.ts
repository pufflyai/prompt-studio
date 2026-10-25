import type { createWorkbenchLayoutCache } from "./controllers/page-runtime/workbench-layout-cache";
import type { WorkbenchCore } from "./workbench-core-types";

export const createWorkbenchHost = (
  layout: WorkbenchCore["layout"],
  cache: ReturnType<typeof createWorkbenchLayoutCache>,
  getContent: () => import("./registries/layout/layout-types").WorkbenchWidgetPlacement | undefined,
) =>
  ({
    getOpenPlacements() {
      const content = getContent();
      return [...cache.listPlacements(layout.getLayout()), ...(content ? [content] : [])];
    },
    getOpenPlacementIds() {
      const ids = new Set(cache.placementIds(layout.getLayout()));
      const content = getContent();
      if (content) ids.add(content.widgetId);
      return ids;
    },
    getSnapshot: () => ({ layout: layout.getLayout() }),
    restoreSnapshot: (snapshot) => layout.restoreLayout(snapshot.layout),
    setPersistenceScope: (scope, scopeInput = {}) =>
      layout.setPersistenceScope(scope, { carryRegionState: scopeInput.carryRegions }),
    getPersistenceScope: layout.getPersistenceScope,
  }) satisfies WorkbenchCore["host"];
