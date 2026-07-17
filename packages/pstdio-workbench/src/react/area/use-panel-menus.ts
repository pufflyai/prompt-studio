import {
  getAnchorResource,
  partitionPanelMenus,
  type SlotId,
  slotSupportsPanelMenus,
  type WorkbenchCore,
} from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { filterSidePanelPlacements } from "./side-panel-placements";

export const usePanelMenus = (workbench: WorkbenchCore, areaId: SlotId) => {
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const openByAreaId = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId);
  const area = layoutState.layout.areas[areaId];
  const placements =
    areaId === "side"
      ? filterSidePanelPlacements(
          area?.widgets ?? [],
          Boolean(getAnchorResource(workbench.layout.getFrame(), layoutState.layout, "primary")),
        )
      : (area?.widgets ?? []);
  const result = partitionPanelMenus({
    areaId,
    placements,
    widgets: layoutState.widgets,
    activeWidgetId: area?.activeWidgetId,
    isOpen: (key) => openByAreaId[key] ?? true,
  });
  const dockable = slotSupportsPanelMenus(workbench.layout.getFrame(), areaId);

  return dockable
    ? { ...result, dockable }
    : {
        ...result,
        docked: { left: undefined, right: undefined },
        toggles: result.menus,
        dockable,
      };
};
