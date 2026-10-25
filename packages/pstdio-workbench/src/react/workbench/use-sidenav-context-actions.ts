import { useReducer } from "react";
import type { WorkbenchCore } from "../../core";
import { useModeChrome } from "../region/mode-chrome";
import { updateSidenavContextActions } from "../shared/sidenav-context-actions";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useSidenavContextActions = (workbench: WorkbenchCore) => {
  const [actionsByOwner, onSidenavContextActionsChange] = useReducer(updateSidenavContextActions, {});
  const chrome = useModeChrome(workbench, "sidenav");
  const active = useWorkbenchStore(workbench.layout.store, (state) => {
    const sidenav = state.layout.regions.sidenav;
    return sidenav.activeWidgetId ?? sidenav.widgets[0]?.widgetId;
  });
  const ownerId = chrome === undefined ? active : chrome;
  return {
    contextActions: ownerId ? (actionsByOwner[ownerId] ?? []) : [],
    onSidenavContextActionsChange,
  };
};
