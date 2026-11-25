import {
  getWorkbenchPanelForMenuRegion,
  type WorkbenchCore,
  type WorkbenchLayout,
  type WorkbenchPanelInstance,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
} from "../../../core";
import { getResourceMenuPage } from "../../../core/controllers/panel-menus/resource-menu-page";
import { findPlacementByWidgetId } from "../../../core/registries/layout/layout-operations";
import { resolvePageActivePlacement } from "../../../core/registries/pages/page-active-placement";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { resolveTreeActiveResource } from "./tree-active-resource";

// Every owned tree follows its live panel; project navigation remains routed.
const hostPanels = new Map<WorkbenchRegion, WorkbenchPanelRegion>(
  workbenchPanelRegions.flatMap((panel) => [
    [panel, panel] as const,
    ...Object.values(workbenchPanelMenuRegions[panel]).map(
      (menu) => [menu, getWorkbenchPanelForMenuRegion(menu)] as const,
    ),
  ]),
);
const hostRegions = [...hostPanels.keys()];

/** Locate owned Main, Side and Secondary trees without consulting focus. */
export const resolveTreeHostRegion = (layout: WorkbenchLayout, instanceId: string) =>
  hostRegions.find((region) =>
    layout.regions[region].widgets.some(
      (placement) => placement.widgetId === instanceId && (placement.pageContext || placement.menuOwnerWidgetId),
    ),
  );

export const useTreeNavigationState = (workbench: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
  "use no memo";
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const routed = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const hostRegion = useWorkbenchStore(workbench.layout.store, (state) =>
    placement ? resolveTreeHostRegion(state.layout, placement.instanceId) : undefined,
  );
  const host = useWorkbenchStore(workbench.layout.store, (state) =>
    hostRegion
      ? state.layout.regions[hostRegion].widgets.find((entry) => entry.widgetId === placement?.instanceId)
      : undefined,
  );
  const owner = host?.menuOwnerWidgetId
    ? findPlacementByWidgetId(workbench.layout.getLayout(), host.menuOwnerWidgetId)?.placement
    : undefined;
  const resourcePage = getResourceMenuPage(workbench, placement?.viewId);
  const capturedLocation = resourcePage
    ? { ...host?.pageContext, page: resourcePage.ref, resource: host?.resource }
    : host?.pageContext;
  const hostPage = capturedLocation?.page;
  const activePage = useWorkbenchStore(workbench.pages.store, (state) => {
    if (!hostPage) return state.activePageId ? state.pages[state.activePageId] : undefined;
    return Object.values(state.pages).find(
      (page) => page.ref.extensionId === hostPage.extensionId && page.ref.id === hostPage.id,
    );
  });
  const region = hostRegion && (capturedLocation || host?.menuOwnerWidgetId) ? hostPanels.get(hostRegion) : undefined;
  const activeLocation = capturedLocation ? { ...capturedLocation, resource: host?.resource } : routed;
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) =>
    resolveTreeActiveResource(state.layout, activePage, activeLocation?.resource, region),
  );
  const identity = useWorkbenchStore(
    workbench.layout.store,
    (state) => resolvePageActivePlacement(state.layout, activePage, undefined, region)?.placementIdentity,
  );
  const slot = identity?.kind === "page" && activePage?.slots.find((slot) => slot.id === identity.slotId);
  // Collection slots select the exact resource row rather than the slot as a whole.
  const activeSlot =
    activePage && slot && (slot.item.kind === "view" || slot.item.binding.cardinality === "one")
      ? { page: activePage.ref, id: slot.id }
      : undefined;
  return { projectId, activeLocation, activeResource, activeSlot, hostRegion: region, owner };
};
