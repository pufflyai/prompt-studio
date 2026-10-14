import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";

export const panelDestinationGroups = (workbench: WorkbenchCore) => {
  const state = workbench.pages.store.getState();
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  const modeId = workbench.modes.getActiveModeId();
  return [
    {
      label: `Stays with ${state.location?.resource?.label ?? page?.title ?? "this page"}`,
      regions: ["main", "bottom", "aside"] as WorkbenchPanelRegion[],
    },
    {
      label: `Follows you in ${modeId ? (workbench.modes.getMode(modeId)?.label ?? modeId) : "this mode"}`,
      regions: ["side", "secondary"] as WorkbenchPanelRegion[],
    },
  ];
};
export const panelDestinationName = (region: WorkbenchPanelRegion) =>
  ({
    main: "Editor",
    aside: "Side panel",
    bottom: "Bottom panel",
    side: "Sidebar",
    secondary: "Bottom panel",
  })[region];
export const panelDropLabel = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) =>
  `${panelDestinationName(region)} · ${panelDestinationGroups(workbench).find((group) => group.regions.includes(region))?.label}`;
