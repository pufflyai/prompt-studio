import type { WorkbenchRegion } from "../../core";

const viewTargetRegions: Record<string, WorkbenchRegion> = {
  "workbench.main": "main",
  "workbench.main.left": "main-left-menu",
  "workbench.main.right": "main-right-menu",
  "workbench.secondary": "secondary",
};

const treeTargetRegions: Record<string, WorkbenchRegion> = {
  "workbench.left.tree": "sidenav",
  "workbench.main.left.tree": "main-left-menu",
  "workbench.main.right.tree": "main-right-menu",
};

const modeTargetRegions: Record<string, WorkbenchRegion> = {
  "workbench.left": "sidenav",
  "workbench.main.left": "main-left-menu",
  "workbench.main": "main",
  "workbench.main.right": "main-right-menu",
  "workbench.secondary": "secondary",
};

export const resolveWorkbenchPanelRegion = (target: string | undefined): WorkbenchRegion =>
  target ? (viewTargetRegions[target] ?? "main") : "main";

export const resolveWorkbenchTreeRegion = (target: string | undefined): WorkbenchRegion =>
  target ? (treeTargetRegions[target] ?? "sidenav") : "sidenav";

export const resolveWorkbenchModeRegion = (target: string | undefined): WorkbenchRegion =>
  target ? (modeTargetRegions[target] ?? "main") : "main";
