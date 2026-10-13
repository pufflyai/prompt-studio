import type { WorkbenchCore, WorkbenchShellOpenRegion } from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";
import type { WorkbenchNavRegionControl } from "../header/workbench-nav-chrome";

interface WorkbenchRegionControlsInput {
  showSidenav: boolean;
  sidenavOpen: boolean;
  showSecondaryPanel: boolean;
  secondaryPanelOpen: boolean;
  hasSidePanel: boolean;
  sidePanelMode: "attached" | "floating" | "closed";
  setPanelOpen(region: WorkbenchShellOpenRegion, open: boolean): void | Promise<void>;
}

export const createWorkbenchRegionControls = (workbench: WorkbenchCore, input: WorkbenchRegionControlsInput) => {
  const controls: WorkbenchNavRegionControl[] = [];
  const add = (
    region: WorkbenchNavRegionControl["id"],
    label: string,
    icon: WorkbenchNavRegionControl["icon"],
    open: boolean,
  ) => {
    const policy = workbench.shell.getPanelPolicy(region);
    if (!policy.provided || !(open ? policy.canClose : policy.canOpen)) return;
    controls.push({
      id: region,
      label,
      icon,
      open,
      onToggle: () => {
        void runUserAction(workbench, label, () => input.setPanelOpen(region, !open));
      },
    });
  };
  if (input.showSidenav && !input.sidenavOpen) add("sidenav", "Show Sidenav", "PanelLeft", false);
  if (input.showSecondaryPanel)
    add(
      "secondary",
      input.secondaryPanelOpen ? "Hide Secondary Panel" : "Show Secondary Panel",
      workbench.getPanelEdge("secondary") === "top" ? "PanelTop" : "PanelBottom",
      input.secondaryPanelOpen,
    );
  if (input.hasSidePanel)
    add(
      "side",
      input.sidePanelMode !== "closed" ? "Hide Side Panel" : "Show Side Panel",
      workbench.getPanelEdge("side") === "left" ? "PanelLeft" : "PanelRight",
      input.sidePanelMode !== "closed",
    );
  return controls;
};
