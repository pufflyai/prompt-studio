import type { WorkbenchCore } from "../../core";
import { useHasSystemNotices } from "../notifications/system-error-state";
import { useWorkbenchPanelMenusPresent } from "../panel-menu/use-panel-menu";
import { useModeChrome } from "../region/mode-chrome";
import { useWorkbenchRegionContent } from "./use-workbench-region-content";

export const useWorkbenchLayoutFlags = (workbench: WorkbenchCore) => {
  const hasDockedStatusBar = useModeChrome(workbench, "status") !== false;
  const hasSystemNotices = useHasSystemNotices(workbench);
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
    hasDockedStatusBar,
    hasStatusContent: hasDockedStatusBar || hasSystemNotices,
  };
};
