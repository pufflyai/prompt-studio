import { prepareWorkbenchNavigation } from "./controllers/navigation/compound-navigation";
import { createWorkbenchPageLocationController } from "./controllers/page-location/page-location-controller";
import {
  createMemoryWorkbenchPageLocationBrowser,
  createMemoryWorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-memory";
import { pageLocationTarget } from "./controllers/page-location/page-location-target";
import type { createLiveWorkbenchPageRegistry } from "./controllers/page-runtime/page-runtime";
import { restorePageLocation } from "./controllers/resource-viewers/resource-viewers";
import type { createWorkbenchModeRegistry } from "./registries/modes/mode-registry";
import type { createNavigationTreeRegistry } from "./registries/navigation/navigation-tree-registry";
import { removeLocationResources } from "./registries/pages/page-location-resource-removal";
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
    defaultPage: input.defaultPage,
    getResourceRemovalVersion: () => resolveCore().resources.getRemovalVersion(),
    getResourceRemovalEpoch: () => resolveCore().resources.getRemovalEpoch(),
    restoreLocation: (location, projectId, removalVersion) =>
      restorePageLocation(resolveCore(), location, projectId, removalVersion),
    navigateTarget: (target, history) => {
      const result = prepareWorkbenchNavigation(resolveCore(), [target], { history }).commit();
      if (!result) throw new Error("Page navigation has no location");
      return result;
    },
    navigateHistory: (location, history) => {
      const result = prepareWorkbenchNavigation(resolveCore(), [pageLocationTarget(location)], { history }).commit();
      if (!result) throw new Error("History navigation has no location");
      return result;
    },
    restoreHistoryLocation: (location, removalVersion) =>
      removeLocationResources(location, registry.listPages(), (resource) =>
        resolveCore().resources.wasRemovedSince(resource, removalVersion),
      ),
    activateLocation: () => {
      const core = resolveCore();
      if (core.pages.getContent()) core.focus.setActiveRegion("main");
    },
  });
