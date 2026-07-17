import {
  partitionPanelMenus,
  type SlotId,
  slotSupportsPanelMenus,
  type WorkbenchCore,
} from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const usePanelMenus = (workbench: WorkbenchCore, areaId: SlotId) => {
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const openByAreaId = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId);
  const area = layoutState.layout.areas[areaId];
  const result = partitionPanelMenus({
    areaId,
    placements: area?.widgets ?? [],
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
