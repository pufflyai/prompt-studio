import type { createWorkbenchLayoutCache } from "./controllers/page-runtime/workbench-layout-cache";
import type { WorkbenchCore } from "./workbench-core-types";

export const createWorkbenchHost = (
  layout: WorkbenchCore["layout"],
  cache: ReturnType<typeof createWorkbenchLayoutCache>,
) =>
  ({
    getOpenPlacements: () => cache.listPlacements(layout.getLayout()),
    getOpenPlacementIds: () => cache.placementIds(layout.getLayout()),
    getSnapshot: () => ({ layout: layout.getLayout() }),
    restoreSnapshot: (snapshot) => layout.restoreLayout(snapshot.layout),
    setPersistenceScope: (scope, scopeInput = {}) =>
      layout.setPersistenceScope(scope, { carryRegionState: scopeInput.carryRegions }),
    getPersistenceScope: layout.getPersistenceScope,
  }) satisfies WorkbenchCore["host"];
