import type { WorkbenchWidgetPlacement } from "../../core";
import {
  getActivePlacement,
  type PanelMenuDetails,
  partitionPanelMenus,
  type SlotId,
  slotSupportsPanelMenus,
  type WorkbenchCore,
} from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { filterSidePanelPlacements } from "./side-panel-placements";

export interface PanelMenusResult {
  tabs: WorkbenchWidgetPlacement[];
  activePanel?: WorkbenchWidgetPlacement;
  menus: PanelMenuDetails[];
  docked: { left?: PanelMenuDetails; right?: PanelMenuDetails };
  toggles: PanelMenuDetails[];
  dockable: boolean;
}

export const usePanelMenus = (workbench: WorkbenchCore, areaId: SlotId): PanelMenusResult => {
  const frame = useWorkbenchStore(workbench.layout.store, (state) => state.frame);
  const area = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[areaId]);
  const primaryArea = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas[state.frame.primary]);
  const widgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const openByAreaId = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId);
  const placements =
    areaId === "side"
      ? filterSidePanelPlacements(area?.widgets ?? [], Boolean(getActivePlacement(primaryArea)?.resource))
      : (area?.widgets ?? []);
  const result = partitionPanelMenus({
    areaId,
    placements,
    widgets,
    activeWidgetId: area?.activeWidgetId,
    isOpen: (key) => openByAreaId[key] ?? true,
  });
  const dockable = slotSupportsPanelMenus(frame, areaId);

  return dockable
    ? { ...result, dockable }
    : {
        ...result,
        docked: { left: undefined, right: undefined },
        toggles: result.menus,
        dockable,
      };
};
