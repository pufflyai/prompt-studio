import type { WorkbenchCore, WorkbenchRegion } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolvePanelCollapsible, setWorkbenchPanelOpen } from "./workbench-panel-state";

// The collapse/reveal state of one panel around the main editor region, bundled so
// WorkbenchBody receives one object per panel instead of six flat props.
export interface WorkbenchPanelView {
  has: boolean;
  hasHeader: boolean;
  icon?: string;
  collapsible: boolean;
  open: boolean;
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

const useHasRegionContent = (workbench: WorkbenchCore, region: WorkbenchRegion) =>
  useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.regions[region].widgets.length > 0 || Boolean(state.placeholders[region]),
  );

const usePanelView = (
  workbench: WorkbenchCore,
  region: MainPanelRegionId,
  options: { hasPrimary: boolean; headerRegion?: WorkbenchRegion; companionOfPrimary?: boolean },
): WorkbenchPanelView => {
  const hasContent = useHasRegionContent(workbench, region);
  const hasHeader = useHasRegionContent(workbench, options.headerRegion ?? region);
  const icon = useWorkbenchStore(workbench.layout.store, (state) => {
    const regionState = state.layout.regions[region];
    const activePlacement =
      regionState.widgets.find((placement) => placement.widgetId === regionState.activeWidgetId) ??
      regionState.widgets[0];
    return activePlacement ? state.widgets[activePlacement.contributionId]?.icon : undefined;
  });
  const collapsible = useWorkbenchStore(workbench.layout.store, () =>
    options.headerRegion
      ? resolvePanelCollapsible(workbench, options.headerRegion, region)
      : resolvePanelCollapsible(workbench, region),
  );
  const open = useWorkbenchStore(workbench.panels.store, (state) => state.openByRegionId[region] ?? true);
  const has =
    (hasContent || (options.headerRegion ? hasHeader : false)) && (!options.companionOfPrimary || options.hasPrimary);

  return {
    has,
    hasHeader: options.headerRegion ? hasHeader : false,
    icon,
    collapsible,
    open,
    collapsed: !open && collapsible,
    onOpen: () => setWorkbenchPanelOpen(workbench, region, true),
    onCollapsedChange: (collapsed) => {
      if (!collapsed || collapsible) setWorkbenchPanelOpen(workbench, region, !collapsed);
    },
  };
};

// Subscribe to derived panel facts rather than the whole layout. Replaying a
// resource can replace the active main placement without rebuilding the shell.
export const useWorkbenchMainPanels = (workbench: WorkbenchCore): WorkbenchMainPanels => {
  const hasMainHeader = useHasRegionContent(workbench, "main-header");
  const hasPrimary = useWorkbenchStore(workbench.layout.store, (state) => {
    const region = state.layout.regions.main;
    const active =
      region.widgets.find((placement) => placement.widgetId === region.activeWidgetId) ?? region.widgets[0];
    return Boolean(active?.resource);
  });
  const mainLeftMenu = usePanelView(workbench, "main-left-menu", { hasPrimary, companionOfPrimary: true });
  const mainRightMenu = usePanelView(workbench, "main-right-menu", { hasPrimary, companionOfPrimary: true });
  const secondaryPanel = usePanelView(workbench, "secondary", { hasPrimary, headerRegion: "secondary-header" });

  return {
    hasMainHeader,
    mainLeftMenu,
    mainRightMenu,
    secondaryPanel,
  };
};
