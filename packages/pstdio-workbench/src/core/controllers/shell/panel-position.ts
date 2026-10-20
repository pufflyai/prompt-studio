import type { LayoutModel } from "../../registries/layout/layout-model";
import {
  panelPositions,
  resolveArrangement,
  type WorkbenchPanelPosition,
  type WorkbenchPositionedRegion,
} from "../../registries/layout/panel-positions";
import type { WorkbenchPanelPolicy } from "./panel-policy";

export const createPanelPositionController = (input: {
  layout: LayoutModel;
  getPolicy(region: WorkbenchPositionedRegion): WorkbenchPanelPolicy;
}) => {
  const getPanelPositions = (region: WorkbenchPositionedRegion) => {
    if (!Object.hasOwn(panelPositions, region)) return [];
    if (!input.getPolicy(region).movable) return [];
    if (
      (region === "main" || region === "secondary") &&
      (!input.getPolicy("main").movable || !input.getPolicy("secondary").movable)
    )
      return [];
    const positions: readonly WorkbenchPanelPosition[] = panelPositions[region];
    return positions;
  };
  return {
    getArrangement: () => resolveArrangement(input.layout.getLayout().arrangement),
    getPanelPositions,
    repositionPanel(region: WorkbenchPositionedRegion, position: WorkbenchPanelPosition) {
      if (!getPanelPositions(region).includes(position)) throw new Error(`Panel cannot move to ${position}: ${region}`);
      const layout = input.layout.getLayout();
      const key = region === "main" ? "secondary" : region;
      let edge = position;
      if (region === "main") edge = position === "top" ? "bottom" : "top";
      input.layout.restoreLayout({ ...layout, arrangement: { ...layout.arrangement, [key]: edge } });
    },
  };
};
