import type { WorkbenchCore, WorkbenchLayout, WorkbenchPanelInstance } from "../../../core";
import { findPlacementByWidgetId } from "../../../core/registries/layout/layout-operations";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { resolveTreeActiveResource } from "./tree-active-resource";

const sidePanelRegions = new Set<string>(["side", "side-header", "side-left-menu", "side-right-menu"]);

/** The Side Panel previews its own page beside Main, so a tree there selects within that preview. */
export const resolveSidePanelTreePlacement = (layout: WorkbenchLayout, instanceId: string) => {
  const found = findPlacementByWidgetId(layout, instanceId);
  return found && sidePanelRegions.has(found.regionId) && found.placement.pageContext ? found.placement : undefined;
};

export const useTreeNavigationState = (workbench: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const activeLocation = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const activePage = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) =>
    resolveTreeActiveResource(state.layout, activePage, activeLocation?.resource),
  );
  const side = useWorkbenchStore(workbench.layout.store, (state) =>
    placement ? resolveSidePanelTreePlacement(state.layout, placement.instanceId) : undefined,
  );
  if (side?.pageContext)
    return {
      projectId,
      activeLocation: { ...side.pageContext, resource: side.resource },
      activeResource: side.resource,
    };
  return { projectId, activeLocation, activeResource };
};
