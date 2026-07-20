import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolvePanelCollapsible, setWorkbenchPanelOpen } from "./workbench-panel-state";

// The collapse/reveal state of one panel around the main editor region, bundled so
// WorkbenchBody receives one object per panel instead of six flat props.
export interface WorkbenchPanelView {
  has: boolean;
  hasHeader: boolean;
  collapsible: boolean;
  collapsed: boolean;
  onOpen: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

export interface WorkbenchMainPanels {
  hasMainHeader: boolean;
  mainLeftMenu: WorkbenchPanelView;
  mainRightMenu: WorkbenchPanelView;
  secondaryPanel: WorkbenchPanelView;
}

type MainPanelRegionId = "main-left-menu" | "main-right-menu" | "secondary";

// Derives the main-region panel state from the layout and panels stores. Owned by
// WorkbenchBody — WorkbenchContent does not use any of these values itself.
export const useWorkbenchMainPanels = (workbench: WorkbenchCore): WorkbenchMainPanels => {
  const regions = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions);
  const placeholders = useWorkbenchStore(workbench.layout.store, (state) => state.placeholders);
  const openByRegionId = useWorkbenchStore(workbench.panels.store, (state) => state.openByRegionId);

  const hasContent = (region: WorkbenchRegion) => regions[region].widgets.length > 0 || Boolean(placeholders[region]);

  // Main menus are companions of the primary (main) anchor — they only make
  // sense alongside a main resource. When `main` has no active resource (e.g. the last
  // main tab was closed) they are hidden by the framework, so apps never wire that.
  const mainActive =
    regions.main.widgets.find((p) => p.widgetId === regions.main.activeWidgetId) ?? regions.main.widgets[0];
  const hasPrimary = Boolean(mainActive?.resource);

  // The Main Panel menus are headerless; only `secondary` carries a
  // header region, so `headerRegion` is optional. `companionOfPrimary` panels also require a
  // primary resource to be shown.
  const resolvePanel = (
    region: MainPanelRegionId,
    headerRegion?: WorkbenchRegion,
    companionOfPrimary = false,
  ): WorkbenchPanelView => {
    const collapsible = headerRegion
      ? resolvePanelCollapsible(workbench, headerRegion, region)
      : resolvePanelCollapsible(workbench, region);
    const open = openByRegionId[region] ?? true;
    const hasOwnContent = hasContent(region) || (headerRegion ? hasContent(headerRegion) : false);

    return {
      has: hasOwnContent && (!companionOfPrimary || hasPrimary),
      hasHeader: headerRegion ? hasContent(headerRegion) : false,
      collapsible,
      collapsed: !open && collapsible,
      onOpen: () => setWorkbenchPanelOpen(workbench, region, true),
      onCollapsedChange: (collapsed) => {
        if (!collapsed || collapsible) setWorkbenchPanelOpen(workbench, region, !collapsed);
      },
    };
  };

  return {
    hasMainHeader: hasContent("main-header"),
    mainLeftMenu: resolvePanel("main-left-menu", undefined, true),
    mainRightMenu: resolvePanel("main-right-menu", undefined, true),
    secondaryPanel: resolvePanel("secondary", "secondary-header"),
  };
};
