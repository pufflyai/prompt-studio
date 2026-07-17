import type { WorkbenchWidgetPlacement } from "../../core";

export const filterSidePanelPlacements = (placements: WorkbenchWidgetPlacement[], hasPrimaryResource: boolean) =>
  placements.filter((placement) => hasPrimaryResource || !placement.companionOfPrimary);
