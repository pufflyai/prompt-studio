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
  return { projectId, activeLocation, activeResource, hostRegion: region };
};
