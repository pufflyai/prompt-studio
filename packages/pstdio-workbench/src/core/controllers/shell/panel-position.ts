import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchLayout, WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import {
  panelPositions,
  resolveArrangement,
  type WorkbenchPanelPosition,
  type WorkbenchPositionedRegion,
} from "../../registries/layout/panel-positions";
import type { WorkbenchPanelPolicy } from "./panel-policy";

const swapSecondaryIntoSide = (layout: WorkbenchLayout, position: "left" | "right") => {
  const { side, secondary } = layout.regions;
  return {
    ...layout,
    arrangement: { ...layout.arrangement, side: position },
    locationSubPanelSelections:
      layout.locationSubPanelSelections &&
      Object.fromEntries(
        Object.entries(layout.locationSubPanelSelections).map(([key, selection]) => [
          key,
          { ...selection, side: selection.secondary, secondary: selection.side },
        ]),
      ),
    regions: {
      ...layout.regions,
      side: {
        ...side,
        widgets: secondary.widgets,
        activeWidgetId: secondary.activeWidgetId,
        savedWidgetOrder: secondary.savedWidgetOrder,
        visible: true,
        presentation: "attached" as const,
      },
      secondary: {
        ...secondary,
        widgets: side.widgets,
        activeWidgetId: side.activeWidgetId,
        savedWidgetOrder: side.savedWidgetOrder,
        visible: false,
      },
    },
  };
};

export const createPanelPositionController = (input: {
  layout: LayoutModel;
  getPolicy(region: WorkbenchPositionedRegion): WorkbenchPanelPolicy;
  getPanelDestinations(instanceId: string): WorkbenchPanelRegion[];
  onMoveSecondaryToSide(): void;
}) => {
  const canMoveSecondaryToSide = () => {
    const side = input.getPolicy("side");
    const secondary = input.getPolicy("secondary");
    if (
      side.open ||
      !side.movable ||
      !side.canOpen ||
      !side.acceptsTabs ||
      !secondary.open ||
      !secondary.movable ||
      !secondary.canClose ||
      !secondary.acceptsTabs
    )
      return false;
    const { regions } = input.layout.getLayout();
    return (
      regions.secondary.widgets.every((tab) => input.getPanelDestinations(tab.widgetId).includes("side")) &&
      regions.side.widgets.every((tab) => input.getPanelDestinations(tab.widgetId).includes("secondary"))
    );
  };
  const getPanelPositions = (region: WorkbenchPositionedRegion) => {
    if (!Object.hasOwn(panelPositions, region)) return [];
    if (!input.getPolicy(region).movable) return [];
    if (region === "main" && !input.getPolicy("secondary").open) return [];
    const verticalBlocked =
      (region === "main" || region === "secondary") &&
      (!input.getPolicy("main").movable || !input.getPolicy("secondary").movable);
    const positions: readonly WorkbenchPanelPosition[] = verticalBlocked ? [] : panelPositions[region];
    if (region === "secondary" && canMoveSecondaryToSide()) return [...positions, ...panelPositions.side];
    return positions;
  };
  return {
    getArrangement: () => resolveArrangement(input.layout.getLayout().arrangement),
    getPanelPositions,
    repositionPanel(region: WorkbenchPositionedRegion, position: WorkbenchPanelPosition) {
      if (!getPanelPositions(region).includes(position)) throw new Error(`Panel cannot move to ${position}: ${region}`);
      const layout = input.layout.getLayout();
      if (region === "secondary" && (position === "left" || position === "right")) {
        input.layout.restoreLayout(swapSecondaryIntoSide(layout, position));
        input.onMoveSecondaryToSide();
        return;
      }
      const key = region === "main" ? "secondary" : region;
      let edge = position;
      if (region === "main") edge = position === "top" ? "bottom" : "top";
      input.layout.restoreLayout({ ...layout, arrangement: { ...layout.arrangement, [key]: edge } });
    },
  };
};
