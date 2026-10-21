import type { WorkbenchCore } from "../../core";
import { useHasSystemErrors } from "../notifications/system-error-state";
import { useWorkbenchPanelMenusPresent } from "../panel-menu/use-panel-menu";
import { useModeChrome } from "../region/mode-chrome";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

export const useWorkbenchLayoutFlags = (workbench: WorkbenchCore) => {
  const statusChrome = useModeChrome(workbench, "status");
  const statusBarItems = useWorkbenchStore(workbench.statusBar.store, (state) => state.items);
  const hasSystemErrors = useHasSystemErrors(workbench);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  const activeModeId = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  return {
    hasNavWidgets: useWorkbenchRegionContent(workbench, "nav"),
    hasActivityBarWidgets: useWorkbenchRegionContent(workbench, "activity"),
    hasSidenavWidgets: useWorkbenchRegionContent(workbench, "sidenav"),
    hasSecondaryHeaderWidgets: useWorkbenchRegionContent(workbench, "secondary-header"),
    hasSecondaryWidgets: useWorkbenchRegionContent(workbench, "secondary", { locationScoped: true }),
    hasSecondaryMenus: useWorkbenchPanelMenusPresent(workbench, "secondary"),
    hasSideHeaderWidgets: useWorkbenchRegionContent(workbench, "side-header"),
    hasSideWidgets: useWorkbenchRegionContent(workbench, "side", { locationScoped: true }),
    hasSideMenus: useWorkbenchPanelMenusPresent(workbench, "side"),
    hasStatusWidgets:
      hasSystemErrors ||
      (statusChrome !== undefined
        ? statusChrome !== false
        : activeModeId === workbench.modes.getActiveModeId() &&
          Object.keys(statusBarItems).length > 0 &&
          workbench.statusBar.listVisibleItems().length > 0),
  };
};
