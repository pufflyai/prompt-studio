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
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { resolveTreeActiveResource } from "./tree-active-resource";

// Secondary and Side present pages beside Main. Each panel's menus belong to that panel.
const hostPanels = new Map<WorkbenchRegion, WorkbenchPanelRegion>(
  workbenchPanelRegions
    .filter((panel) => panel !== "main")
    .flatMap((panel) => [
      [panel, panel] as const,
      ...Object.values(workbenchPanelMenuRegions[panel]).map(
        (menu) => [menu, getWorkbenchPanelForMenuRegion(menu)] as const,
      ),
    ]),
);
const hostRegions = [...hostPanels.keys()];

/**
 * The panel region of a tree hosted by a page presented outside Main, such as a Side preview's Files menu.
 * Only the Secondary and Side regions are searched, so Main trees never match.
 */
export const resolveTreeHostRegion = (layout: WorkbenchLayout, instanceId: string) =>
  hostRegions.find((region) =>
    layout.regions[region].widgets.some((placement) => placement.widgetId === instanceId && placement.pageContext),
  );

export const useTreeNavigationState = (workbench: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
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
  const hostPage = host?.pageContext?.page;
  const activePage = useWorkbenchStore(workbench.pages.store, (state) => {
    if (!hostPage) return state.activePageId ? state.pages[state.activePageId] : undefined;
    return Object.values(state.pages).find(
      (page) => page.ref.extensionId === hostPage.extensionId && page.ref.id === hostPage.id,
    );
  });
  const region = hostRegion && host?.pageContext ? hostPanels.get(hostRegion) : undefined;
  const activeLocation = host?.pageContext ? { ...host.pageContext, resource: host.resource } : routed;
  const activeResource = useWorkbenchStore(workbench.layout.store, (state) =>
    resolveTreeActiveResource(state.layout, activePage, activeLocation?.resource, region),
  );
  return { projectId, activeLocation, activeResource, hostRegion: region };
};
