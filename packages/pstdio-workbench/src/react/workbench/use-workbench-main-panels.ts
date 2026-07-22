import type { WorkbenchCore } from "../../core";
import { useWorkbenchPanelHeaderVisible } from "../region/region-tabs";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";
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

const useSecondaryPanelView = (workbench: WorkbenchCore) => {
  const hasContent = useWorkbenchRegionContent(workbench, "secondary", { locationScoped: true });
  const hasHeader = useWorkbenchRegionContent(workbench, "secondary-header");
  const hasPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "secondary");
  const collapsible = useWorkbenchStore(workbench.layout.store, () =>
    resolvePanelCollapsible(workbench, "secondary-header", "secondary"),
  );
  const open = useWorkbenchStore(workbench.panels.store, (state) => state.openByRegionId.secondary ?? true);

  return {
    has: hasContent || hasHeader || hasPanelHeader,
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
  const hasMainHeader = useWorkbenchRegionContent(workbench, "main-header");
  const secondaryPanel = useSecondaryPanelView(workbench);

  return {
    hasMainHeader,
    secondaryPanel,
  };
};
