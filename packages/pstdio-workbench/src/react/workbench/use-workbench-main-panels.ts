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
  onCollapsedChange: (collapsed: boolean) => void;
}

export interface WorkbenchMainPanels {
  hasMainHeader: boolean;
  secondaryPanel: WorkbenchPanelView;
}

const useHasRegionContent = (workbench: WorkbenchCore, region: WorkbenchRegion) =>
  useWorkbenchStore(
    workbench.layout.store,
    (state) => state.layout.regions[region].widgets.length > 0 || Boolean(state.placeholders[region]),
  );

const useSecondaryPanelView = (workbench: WorkbenchCore) => {
  const hasContent = useHasRegionContent(workbench, "secondary");
  const hasHeader = useHasRegionContent(workbench, "secondary-header");
  const collapsible = useWorkbenchStore(workbench.layout.store, () =>
    resolvePanelCollapsible(workbench, "secondary-header", "secondary"),
  );
  const open = useWorkbenchStore(workbench.panels.store, (state) => state.openByRegionId.secondary ?? true);

  return {
    has: hasContent || hasHeader,
    hasHeader,
    collapsible,
    collapsed: !open && collapsible,
    onCollapsedChange: (collapsed: boolean) => {
      if (!collapsed || collapsible) setWorkbenchPanelOpen(workbench, "secondary", !collapsed);
    },
  };
};

// Subscribe to derived panel facts rather than the whole layout. Replaying a
// resource can replace the active main placement without rebuilding the shell.
export const useWorkbenchMainPanels = (workbench: WorkbenchCore) => {
  const hasMainHeader = useHasRegionContent(workbench, "main-header");
  const secondaryPanel = useSecondaryPanelView(workbench);

  return {
    hasMainHeader,
    secondaryPanel,
  };
};
