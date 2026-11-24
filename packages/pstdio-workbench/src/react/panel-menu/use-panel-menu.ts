import { useUiScope } from "@pstdio/ui";
import { useLayoutEffect, useState } from "react";
import {
  isWorkbenchModePanelAvailable,
  type WorkbenchCore,
  type WorkbenchPanelMenuRegion,
  type WorkbenchPanelMenuSide,
  type WorkbenchPanelRegion,
  type WorkbenchRegionSize,
  workbenchPanelMenuRegions,
} from "../../core";
import { useWorkbenchActiveModeId } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolvePanelCollapsible } from "../workbench/workbench-panel-state";
import { resolvePanelMenuRegionState } from "./panel-menu-placements";
import { getWorkbenchPanelMenuAttachment } from "./panel-menu-sizing";
import { usePanelMenuContent } from "./use-panel-menu-content";

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
  placementId?: string;
  canAttach?: boolean;
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
  "use no memo";
  const region = workbenchPanelMenuRegions[panel][side];
  const modeId = useWorkbenchActiveModeId(workbench);
  const panelAvailable = isWorkbenchModePanelAvailable(modeId ? workbench.modes.getMode(modeId) : undefined, panel);
  useWorkbenchStore(workbench.layout.store, (state) => state);
  useWorkbenchStore(workbench.pages.store, (state) => state);
  const regionState = resolvePanelMenuRegionState(workbench, region);
  const activePlacement =
    regionState.widgets.find((placement) => placement.widgetId === regionState.activeWidgetId) ??
    regionState.widgets[0];
  const widget = activePlacement ? workbench.layout.getWidget(activePlacement.contributionId) : undefined;
  const hasContent = usePanelMenuContent(workbench, activePlacement);
  const collapsible = useWorkbenchStore(workbench.layout.store, () => resolvePanelCollapsible(workbench, region));
  const panelStateKey = activePlacement ? `panel-menu:${activePlacement.widgetId}` : region;
  const open = useWorkbenchStore(
    workbench.panelMenuState.store,
    (state) => state.openByMenuId[panelStateKey] ?? !activePlacement?.hiddenByDefault,
  );

  return {
    region,
    placementId: activePlacement?.widgetId,
    side,
    label: getWorkbenchPanelMenuLabel(panel, side),
    title: widget?.title ?? getWorkbenchPanelMenuLabel(panel, side),
    icon: widget?.icon ?? (side === "left" ? "PanelLeftOpen" : "PanelRightOpen"),
    has:
      panelAvailable &&
      hasContent &&
      (regionState.widgets.length > 0 || Boolean(workbench.layout.getPlaceholder(region))),
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
  "use no memo";
  const views = [
    useWorkbenchPanelMenu(workbench, panel, "left"),
    useWorkbenchPanelMenu(workbench, panel, "right"),
    useWorkbenchPanelMenu(workbench, panel, "bottom"),
  ];
  const attachment = useWorkbenchPanelMenuAttachment(workbench, panel, views[0]!, views[1]!, views[2]!);
  return views.map((view, index) => ({ ...view, canAttach: Boolean(attachment[index]) }));
};

export const useWorkbenchPanelMenusPresent = (workbench: WorkbenchCore, panel: WorkbenchPanelRegion) => {
  const left = useWorkbenchPanelMenu(workbench, panel, "left");
  const right = useWorkbenchPanelMenu(workbench, panel, "right");
  const bottom = useWorkbenchPanelMenu(workbench, panel, "bottom");
  return left.has || right.has || bottom.has;
};

const useWorkbenchPanelMenuAttachment = (
  workbench: WorkbenchCore,
  panel: WorkbenchPanelRegion,
  left: WorkbenchPanelMenuView,
  right: WorkbenchPanelMenuView,
  bottom: WorkbenchPanelMenuView,
) => {
  const root = useUiScope()?.root;
  const { has: leftHas, collapsed: leftCollapsed, collapsible: leftCollapsible } = left;
  const { has: rightHas, collapsed: rightCollapsed, collapsible: rightCollapsible } = right;
  const leftMin = left.size.minPx;
  const rightMin = right.size.minPx;
  const bottomMin = bottom.size.minPx;
  const [attachment, setAttachment] = useState(() => [
    ...getWorkbenchPanelMenuAttachment(0, [
      { has: leftHas, open: !leftCollapsed, collapsible: leftCollapsible, minSize: leftMin },
      { has: rightHas, open: !rightCollapsed, collapsible: rightCollapsible, minSize: rightMin },
    ]),
    true,
  ]);

  const sideMode = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode());
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Moving between retained hosts can change visibility without resizing either host.
  useLayoutEffect(() => {
    const elements = [
      ...(root?.current ?? document).querySelectorAll<HTMLElement>(`[data-workbench-panel="${panel}"]`),
    ];
    if (!elements.length) return;

    const menus = [
      { has: leftHas, open: !leftCollapsed, collapsible: leftCollapsible, minSize: leftMin },
      { has: rightHas, open: !rightCollapsed, collapsible: rightCollapsible, minSize: rightMin },
    ];
    const measure = () => {
      const element = elements.find((element) => !element.closest("[inert]") && element.clientWidth > 0);
      if (!element) return;
      const { clientWidth: width, clientHeight: height } = element;
      const sides = getWorkbenchPanelMenuAttachment(width, menus);
      const next = [...sides, width > 580 && height >= bottomMin + 184];
      // Split motion reports a width every frame; menus only change at attachment thresholds.
      setAttachment((previous) => (previous.every((value, index) => value === next[index]) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [
    sideMode,
    fullscreen,
    panel,
    root,
    leftHas,
    leftCollapsed,
    leftCollapsible,
    leftMin,
    rightHas,
    rightCollapsed,
    rightCollapsible,
    rightMin,
    bottomMin,
  ]);

  return attachment;
};
