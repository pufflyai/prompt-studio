import { useLayoutEffect, useState } from "react";
import {
  getActiveWorkbenchSubPanel,
  isWorkbenchModePanelAvailable,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchModeEligibility,
  matchesWorkbenchPanelMenuOwner,
  type WorkbenchCore,
  type WorkbenchPanelMenuRegion,
  type WorkbenchPanelMenuSide,
  type WorkbenchPanelRegion,
  type WorkbenchRegionSize,
  workbenchPanelMenuRegions,
} from "../../core";
import { useWorkbenchLocationPanel } from "../shared/use-workbench-location-panel";
import { useWorkbenchActiveModeId, useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolvePanelCollapsible } from "../workbench/workbench-panel-state";
import { getWorkbenchPanelMenuAttachment } from "./panel-menu-sizing";

const PANEL_MENU_SIZE = { defaultPx: 280, minPx: 144, maxPx: 320 };

const panelLabels: Record<WorkbenchPanelRegion, string> = {
  main: "Main",
  secondary: "Secondary",
  side: "Side",
};

const resolveRegionSize = (regionSize: WorkbenchRegionSize | undefined) => ({
  defaultPx: regionSize?.defaultPx ?? PANEL_MENU_SIZE.defaultPx,
  minPx: regionSize?.minPx ?? PANEL_MENU_SIZE.minPx,
  maxPx: regionSize ? regionSize.maxPx : PANEL_MENU_SIZE.maxPx,
});

export const getWorkbenchPanelMenuLabel = (panel: WorkbenchPanelRegion, side: WorkbenchPanelMenuSide) =>
  `${panelLabels[panel]} ${side} menu`;

export interface WorkbenchPanelMenuView {
  region: WorkbenchPanelMenuRegion;
  side: WorkbenchPanelMenuSide;
  label: string;
  title: string;
  icon: string;
  has: boolean;
  collapsed: boolean;
  collapsible: boolean;
  size: ReturnType<typeof resolveRegionSize>;
  onOpen: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

const useWorkbenchPanelMenu = (
  workbench: WorkbenchCore,
  panel: WorkbenchPanelRegion,
  side: WorkbenchPanelMenuSide,
): WorkbenchPanelMenuView => {
  const region = workbenchPanelMenuRegions[panel][side];
  const locationResource = useWorkbenchLocationResource(workbench);
  const modeId = useWorkbenchActiveModeId(workbench);
  const panelAvailable = isWorkbenchModePanelAvailable(modeId ? workbench.modes.getMode(modeId) : undefined, panel);
  const registeredWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const currentRegionState = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions[region]);
  const activeSubPanel = useWorkbenchStore(workbench.layout.store, (state) =>
    getActiveWorkbenchSubPanel(state.layout, panel, locationResource, { ignoreOwnerResourceKey: panel === "side" }),
  );
  const activeLocationPanel = useWorkbenchLocationPanel(workbench, panel);
  const regionState = {
    ...currentRegionState,
    widgets: currentRegionState.widgets.filter((placement) => {
      const contribution = registeredWidgets[placement.contributionId];
      return contribution
        ? (panel === "side"
            ? matchesWorkbenchModeEligibility(contribution, modeId)
            : isWorkbenchPanelPlacementVisible(contribution, locationResource, modeId, placement, {
                location: activeLocationPanel,
              })) &&
            matchesWorkbenchPanelMenuOwner(contribution, {
              locationPanel: activeLocationPanel,
              subPanel: activeSubPanel,
            })
        : false;
    }),
  };
  const activePlacement =
    regionState.widgets.find((placement) => placement.widgetId === regionState.activeWidgetId) ??
    regionState.widgets[0];
  const widget = activePlacement ? registeredWidgets[activePlacement.contributionId] : undefined;
  const collapsible = useWorkbenchStore(workbench.layout.store, () => resolvePanelCollapsible(workbench, region));
  const panelStateKey = activePlacement ? `panel-menu:${activePlacement.widgetId}` : region;
  const open = useWorkbenchStore(workbench.panelMenuState.store, (state) => state.openByMenuId[panelStateKey] ?? true);

  return {
    region,
    side,
    label: getWorkbenchPanelMenuLabel(panel, side),
    title: widget?.title ?? getWorkbenchPanelMenuLabel(panel, side),
    icon: widget?.icon ?? (side === "left" ? "PanelLeft" : "PanelRight"),
    has: panelAvailable && (regionState.widgets.length > 0 || Boolean(workbench.layout.getPlaceholder(region))),
    collapsed: !open && collapsible,
    collapsible,
    size: resolveRegionSize(workbench.layout.getRegionSize(region)),
    onOpen: () => workbench.panelMenuState.setOpen(panelStateKey, true),
    onCollapsedChange: (collapsed) => {
      if (!collapsed || collapsible) workbench.panelMenuState.setOpen(panelStateKey, !collapsed);
    },
  };
};

export const useWorkbenchPanelMenus = (workbench: WorkbenchCore, panel: WorkbenchPanelRegion) => {
  const views = [useWorkbenchPanelMenu(workbench, panel, "left"), useWorkbenchPanelMenu(workbench, panel, "right")];
  const attachment = useWorkbenchPanelMenuAttachment(panel, views[0]!, views[1]!);
  return views.map((view, index) => ({
    ...view,
    canAttach: attachment[index],
    collapsed: view.collapsed || !attachment[index],
  }));
};

export const useWorkbenchPanelMenusPresent = (workbench: WorkbenchCore, panel: WorkbenchPanelRegion) => {
  const left = useWorkbenchPanelMenu(workbench, panel, "left");
  const right = useWorkbenchPanelMenu(workbench, panel, "right");
  return left.has || right.has;
};

const useWorkbenchPanelMenuAttachment = (
  panel: WorkbenchPanelRegion,
  left: WorkbenchPanelMenuView,
  right: WorkbenchPanelMenuView,
) => {
  const { has: leftHas, collapsed: leftCollapsed, collapsible: leftCollapsible } = left;
  const { has: rightHas, collapsed: rightCollapsed, collapsible: rightCollapsible } = right;
  const leftMin = left.size.minPx;
  const rightMin = right.size.minPx;
  const [attachment, setAttachment] = useState(() =>
    getWorkbenchPanelMenuAttachment(0, [
      { has: leftHas, open: !leftCollapsed, collapsible: leftCollapsible, minSize: leftMin },
      { has: rightHas, open: !rightCollapsed, collapsible: rightCollapsible, minSize: rightMin },
    ]),
  );

  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-workbench-panel="${panel}"]`);
    if (!element) return;

    const menus = [
      { has: leftHas, open: !leftCollapsed, collapsible: leftCollapsible, minSize: leftMin },
      { has: rightHas, open: !rightCollapsed, collapsible: rightCollapsible, minSize: rightMin },
    ];
    const measure = () => {
      const width = element.clientWidth;
      if (width === 0) return;
      const next = getWorkbenchPanelMenuAttachment(width, menus);
      // Split motion reports a width every frame; menus only change at attachment thresholds.
      setAttachment((previous) => (previous.every((value, index) => value === next[index]) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [panel, leftHas, leftCollapsed, leftCollapsible, leftMin, rightHas, rightCollapsed, rightCollapsible, rightMin]);

  return attachment;
};
