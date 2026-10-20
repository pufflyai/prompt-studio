export const panelPositions = {
  side: ["left", "right"],
  sidenav: ["left", "right"],
  main: ["top", "bottom"],
  secondary: ["top", "bottom"],
  activity: ["left", "right", "top", "bottom"],
} as const;

export type WorkbenchPositionedRegion = keyof typeof panelPositions;
export type WorkbenchPanelPosition = "left" | "right" | "top" | "bottom";
export interface WorkbenchArrangement {
  side: "left" | "right";
  sidenav: "left" | "right";
  secondary: "top" | "bottom";
  activity: WorkbenchPanelPosition;
}
export const defaultArrangement: WorkbenchArrangement = {
  side: "right",
  sidenav: "left",
  secondary: "bottom",
  activity: "left",
};

const supportedPosition = <T extends WorkbenchPanelPosition>(
  value: T | undefined,
  allowed: readonly T[],
  fallback: T,
) => (value && allowed.includes(value) ? value : fallback);

export const resolveArrangement = (saved?: Partial<WorkbenchArrangement>) => ({
  side: supportedPosition(saved?.side, panelPositions.side, defaultArrangement.side),
  sidenav: supportedPosition(saved?.sidenav, panelPositions.sidenav, defaultArrangement.sidenav),
  secondary: supportedPosition(saved?.secondary, panelPositions.secondary, defaultArrangement.secondary),
  activity: supportedPosition(saved?.activity, panelPositions.activity, defaultArrangement.activity),
});
