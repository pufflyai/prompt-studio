export const workbenchRegions = [
  "nav",
  "activity",
  "sidenav",
  "main-header",
  "main-left-menu",
  "main",
  "main-right-menu",
  "aside-header",
  "aside-left-menu",
  "aside",
  "aside-right-menu",
  "bottom-header",
  "bottom-left-menu",
  "bottom",
  "bottom-right-menu",
  "secondary-header",
  "secondary-left-menu",
  "secondary",
  "secondary-right-menu",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
  "overlay",
] as const;

export type WorkbenchRegion = (typeof workbenchRegions)[number];

export const workbenchModePanelRegions = ["main", "secondary", "side"] as const satisfies readonly WorkbenchRegion[];
export const workbenchPanelRegions = [
  ...workbenchModePanelRegions,
  "bottom",
  "aside",
] as const satisfies readonly WorkbenchRegion[];

export type WorkbenchPanelRegion = (typeof workbenchPanelRegions)[number];

export type WorkbenchPanelMenuSide = "left" | "right";

export const workbenchPanelMenuRegions = {
  main: { left: "main-left-menu", right: "main-right-menu" },
  secondary: { left: "secondary-left-menu", right: "secondary-right-menu" },
  side: { left: "side-left-menu", right: "side-right-menu" },
  aside: { left: "aside-left-menu", right: "aside-right-menu" },
  bottom: { left: "bottom-left-menu", right: "bottom-right-menu" },
} as const satisfies Record<WorkbenchPanelRegion, Record<WorkbenchPanelMenuSide, WorkbenchRegion>>;

export type WorkbenchMenuPanelRegion = keyof typeof workbenchPanelMenuRegions;
export type WorkbenchPanelMenuRegion =
  (typeof workbenchPanelMenuRegions)[WorkbenchMenuPanelRegion][WorkbenchPanelMenuSide];

const workbenchPanelByMenuRegion = {
  "main-left-menu": "main",
  "main-right-menu": "main",
  "secondary-left-menu": "secondary",
  "secondary-right-menu": "secondary",
  "side-left-menu": "side",
  "side-right-menu": "side",
  "aside-left-menu": "aside",
  "aside-right-menu": "aside",
  "bottom-left-menu": "bottom",
  "bottom-right-menu": "bottom",
} as const satisfies Record<WorkbenchPanelMenuRegion, WorkbenchPanelRegion>;

export const getWorkbenchPanelForMenuRegion = (region: WorkbenchPanelMenuRegion) => workbenchPanelByMenuRegion[region];
