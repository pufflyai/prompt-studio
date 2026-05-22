import type { WorkbenchArea, WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolvePanelCollapsible, setWorkbenchPanelOpen } from "./workbench-panel-state";

// The collapse/reveal state of one panel around the main editor area, bundled so
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
  mainLeft: WorkbenchPanelView;
  mainRight: WorkbenchPanelView;
  mainBottom: WorkbenchPanelView;
}

type MainPanelAreaId = "main-left" | "main-right" | "main-bottom";

// Derives the main-area panel state from the layout and panels stores. Owned by
// WorkbenchBody — WorkbenchContent does not use any of these values itself.
export const useWorkbenchMainPanels = (workbench: WorkbenchCore): WorkbenchMainPanels => {
  const areas = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas);
  const placeholders = useWorkbenchStore(workbench.layout.store, (state) => state.placeholders);
  const openByAreaId = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId);

  const hasContent = (area: WorkbenchArea) => areas[area].widgets.length > 0 || Boolean(placeholders[area]);

  const resolvePanel = (area: MainPanelAreaId, headerArea: WorkbenchArea): WorkbenchPanelView => {
    const collapsible = resolvePanelCollapsible(workbench, headerArea, area);
    const open = openByAreaId[area] ?? true;

    return {
      has: hasContent(area) || hasContent(headerArea),
      hasHeader: hasContent(headerArea),
      collapsible,
      collapsed: !open && collapsible,
      onOpen: () => setWorkbenchPanelOpen(workbench, area, true),
      onCollapsedChange: (collapsed) => {
        if (!collapsed || collapsible) setWorkbenchPanelOpen(workbench, area, !collapsed);
      },
    };
  };

  return {
    hasMainHeader: hasContent("main-header"),
    mainLeft: resolvePanel("main-left", "main-left-header"),
    mainRight: resolvePanel("main-right", "main-right-header"),
    mainBottom: resolvePanel("main-bottom", "main-bottom-header"),
  };
};
