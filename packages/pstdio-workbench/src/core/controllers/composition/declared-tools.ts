import type { WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import type { WorkbenchCompositionRegionPanels } from "./composition-controller";

/** A moved tool is still offered at its declared panel; opening it focuses its current owner. */
export const closedDeclaredTools = (panels: WorkbenchCompositionRegionPanels, region: WorkbenchPanelRegion) =>
  panels.addable.filter(
    (tool) => tool.declaredRegion === region && !panels.open.some((tab) => tab.contributionId === tool.panelId),
  );
