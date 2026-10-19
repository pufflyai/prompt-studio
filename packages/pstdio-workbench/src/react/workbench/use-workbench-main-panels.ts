import type { WorkbenchCore } from "../../core";
import { useWorkbenchPanelMenusPresent } from "../panel-menu/use-panel-menu";
import { useWorkbenchPanelHeaderVisible } from "../region/region-tabs";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";
import { resolvePanelCollapsible } from "./workbench-panel-state";

// The collapse/reveal state of one panel around the main editor region, bundled so
// WorkbenchBody receives one object per panel instead of six flat props.
const useSecondaryPanelView = (workbench: WorkbenchCore) => {
  const policy = usePanelPolicy(workbench, "secondary");
  const hasContent = useWorkbenchRegionContent(workbench, "secondary", { locationScoped: true });
  const hasPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "secondary");
  const hasMenus = useWorkbenchPanelMenusPresent(workbench, "secondary");
  const hasHeader = useWorkbenchRegionContent(workbench, "secondary-header");
  const collapsible = useWorkbenchStore(workbench.layout.store, () =>
    resolvePanelCollapsible(workbench, "secondary-header", "secondary"),
  );
  const open = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.secondary.visible);

  return {
    has: (policy.provided && !policy.canClose) || hasContent || hasHeader || hasPanelHeader || hasMenus,
    hasHeader,
    collapsible,
    collapsed: !open,
    onCollapsedChange: (collapsed: boolean) => {
      if (!collapsed || collapsible) workbench.shell.setRegionOpen("secondary", !collapsed);
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
