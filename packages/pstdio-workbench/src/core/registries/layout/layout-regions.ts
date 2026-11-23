export const workbenchRegions = [
  "nav",
  "activity",
  "sidenav",
  "main-header",
  "main-left-menu",
  "main",
  "main-right-menu",
  "main-bottom-menu",
  "secondary-header",
  "secondary-left-menu",
  "secondary",
  "secondary-right-menu",
  "secondary-bottom-menu",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "side-bottom-menu",
  "status",
  "overlay",
] as const;

export type WorkbenchRegion = (typeof workbenchRegions)[number];

export const workbenchPanelRegions = ["main", "secondary", "side"] as const satisfies readonly WorkbenchRegion[];

export type WorkbenchPanelRegion = (typeof workbenchPanelRegions)[number];

export type WorkbenchPanelMenuSide = "left" | "right" | "bottom";

export const workbenchPanelMenuRegions = {
  main: { left: "main-left-menu", right: "main-right-menu", bottom: "main-bottom-menu" },
  secondary: { left: "secondary-left-menu", right: "secondary-right-menu", bottom: "secondary-bottom-menu" },
  side: { left: "side-left-menu", right: "side-right-menu", bottom: "side-bottom-menu" },
} as const satisfies Record<WorkbenchPanelRegion, Record<WorkbenchPanelMenuSide, WorkbenchRegion>>;

export type WorkbenchPanelMenuRegion = (typeof workbenchPanelMenuRegions)[WorkbenchPanelRegion][WorkbenchPanelMenuSide];

const workbenchPanelByMenuRegion = {
  "main-left-menu": "main",
  "main-right-menu": "main",
  "main-bottom-menu": "main",
  "secondary-left-menu": "secondary",
  "secondary-right-menu": "secondary",
  "secondary-bottom-menu": "secondary",
  "side-left-menu": "side",
  "side-right-menu": "side",
  "side-bottom-menu": "side",
} as const satisfies Record<WorkbenchPanelMenuRegion, WorkbenchPanelRegion>;

export const getWorkbenchPanelForMenuRegion = (region: WorkbenchPanelMenuRegion) => workbenchPanelByMenuRegion[region];

export const isWorkbenchPanelMenuRegion = (region: WorkbenchRegion): region is WorkbenchPanelMenuRegion =>
  region in workbenchPanelByMenuRegion;
