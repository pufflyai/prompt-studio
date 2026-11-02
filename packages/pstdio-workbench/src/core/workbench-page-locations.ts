import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbenchPageLocationController } from "./controllers/page-location/page-location-controller";
import {
  createMemoryWorkbenchPageLocationBrowser,
  createMemoryWorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-memory";
import type { createLiveWorkbenchPageRegistry } from "./controllers/page-runtime/page-runtime";
import { focusPageResource, restorePageLocation } from "./controllers/resource-viewers/resource-viewers";
import type { createWorkbenchModeRegistry } from "./registries/modes/mode-registry";
import type { createNavigationTreeRegistry } from "./registries/navigation/navigation-tree-registry";
import type { createWorkbenchInput, WorkbenchCore } from "./workbench-core-types";
export const createPageLocations = (
  input: createWorkbenchInput,
  registry: ReturnType<typeof createLiveWorkbenchPageRegistry>,
  navigationTrees: ReturnType<typeof createNavigationTreeRegistry>,
  modes: ReturnType<typeof createWorkbenchModeRegistry>,
  resolveCore: () => WorkbenchCore,
) =>
  createWorkbenchPageLocationController({
    registry,
    browser: input.pageLocationBrowser ?? createMemoryWorkbenchPageLocationBrowser(),
    navigationTrees,
    modes,
    persistence: input.pageLocationPersistence ?? createMemoryWorkbenchPageLocationPersistence(),
    startPage: input.startPage ?? workbenchPages.start,
    getResourceRemovalVersion: () => resolveCore().resources.getRemovalVersion(),
    getResourceRemovalEpoch: () => resolveCore().resources.getRemovalEpoch(),
    restoreLocation: (location, projectId, removalVersion) =>
      restorePageLocation(resolveCore(), location, projectId, removalVersion),
    focusResource: (location, open) => focusPageResource(resolveCore(), location, open),
    activateLocation: () => {
      const core = resolveCore();
      if (core.pages.getContent()) core.focus.setActiveRegion("main");
    },
  });
