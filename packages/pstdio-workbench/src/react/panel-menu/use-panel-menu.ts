import { useEffect, useState } from "react";
import {
  getActiveWorkbenchLocationPanel,
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
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const registeredWidgets = useWorkbenchStore(workbench.layout.store, (state) => state.widgets);
  const currentRegionState = layout.regions[region];
  const activeSubPanel = getActiveWorkbenchSubPanel(layout, panel, locationResource, {
    ignoreOwnerResourceKey: panel === "side",
  });
  const activeLocationPanel = getActiveWorkbenchLocationPanel(layout);
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
  const width = useWorkbenchPanelWidth(panel);
  const views = [useWorkbenchPanelMenu(workbench, panel, "left"), useWorkbenchPanelMenu(workbench, panel, "right")];
  const attachment = getWorkbenchPanelMenuAttachment(
    width,
    views.map((view) => ({
      has: view.has,
      open: !view.collapsed,
      collapsible: view.collapsible,
      minSize: view.size.minPx,
    })),
  );
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

const useWorkbenchPanelWidth = (panel: WorkbenchPanelRegion) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-workbench-panel="${panel}"]`);
    if (!element) return;

    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [panel]);

  return width;
};
