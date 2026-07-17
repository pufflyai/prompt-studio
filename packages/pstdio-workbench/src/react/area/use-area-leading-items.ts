import {
  getAnchorResource,
  listOpenablePanels,
  type SlotId,
  type WorkbenchCore,
  workbenchAreaTabLeadingMenuPath,
} from "../../core";
import { listWorkbenchMenuItemsFromState } from "../menus/menu-items";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useAreaLeadingItems = (workbench: WorkbenchCore, area: SlotId) => {
  const commands = useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  const contextValues = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const itemsByPath = useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  const layoutState = useWorkbenchStore(workbench.layout.store, (state) => state);
  const primary = getAnchorResource(layoutState.frame, layoutState.layout, "primary");
  const items = listWorkbenchMenuItemsFromState(
    { itemsByPath, commands, contextValues },
    workbenchAreaTabLeadingMenuPath(area),
  );
  const openablePanels = listOpenablePanels({
    widgets: workbench.layout.listWidgets(),
    frame: layoutState.frame,
    slot: area,
    primary,
    layout: layoutState.layout,
  });

  return {
    items,
    openablePanels,
    primary,
    hasLeadingActions: items.length > 0 || openablePanels.length > 0,
  };
};
