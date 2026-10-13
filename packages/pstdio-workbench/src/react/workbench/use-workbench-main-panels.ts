import type { WorkbenchCore } from "../../core";
import { useWorkbenchPanelMenusPresent } from "../panel-menu/use-panel-menu";
import { useWorkbenchPanelHeaderVisible } from "../region/region-tabs";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

// The collapse/reveal state of one panel around the main editor region, bundled so
// WorkbenchBody receives one object per panel instead of six flat props.
const useSecondaryPanelView = (workbench: WorkbenchCore) => {
  const hasContent = useWorkbenchRegionContent(workbench, "secondary", { locationScoped: true });
  const hasHeader = useWorkbenchRegionContent(workbench, "secondary-header");
  const hasPanelHeader = useWorkbenchPanelHeaderVisible(workbench, "secondary");
  const hasMenus = useWorkbenchPanelMenusPresent(workbench, "secondary");
  const policy = usePanelPolicy(workbench, "secondary");
  const collapsible = policy.canClose && workbench.layout.getRegionCollapsible("secondary");

  return {
    has: policy.provided && (hasContent || hasHeader || hasPanelHeader || hasMenus || policy.open),
    hasHeader,
    collapsible,
    collapsed: !policy.open,
    resizable: policy.resizable,
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
