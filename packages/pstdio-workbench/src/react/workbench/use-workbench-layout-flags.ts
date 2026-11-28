import type { WorkbenchCore } from "../../core";
import { useWorkbenchPanelMenusPresent } from "../panel-menu/use-panel-menu";
import { useStatusBarVisibility } from "./use-status-bar-visibility";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

export const useWorkbenchLayoutFlags = (workbench: WorkbenchCore) => {
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
    ...useStatusBarVisibility(workbench),
  };
};
