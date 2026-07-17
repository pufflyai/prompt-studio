import type { Frame } from "./frame-types";
import type { PanelMenuBinding, RegisteredWidgetContribution, SlotId, WorkbenchWidgetPlacement } from "./layout-types";

export interface PanelMenuDetails {
  key: string;
  binding: PanelMenuBinding;
  placement: WorkbenchWidgetPlacement;
  widget: RegisteredWidgetContribution;
}

export interface PartitionPanelMenusInput {
  areaId: SlotId;
  placements: WorkbenchWidgetPlacement[];
  widgets: Record<string, RegisteredWidgetContribution>;
  activeWidgetId?: string;
  isOpen(key: string): boolean;
}

export const panelMenuOpenKey = (areaId: SlotId, widgetId: string) => `menu:${areaId}:${widgetId}`;

export const slotSupportsPanelMenus = (frame: Frame, areaId: SlotId) => {
  const regions = frame.slots[areaId]?.regions;
  return Boolean(regions?.leftMenu && regions.rightMenu);
};

export const listPanelTabPlacements = (
  placements: WorkbenchWidgetPlacement[],
  widgets: Record<string, RegisteredWidgetContribution>,
) => placements.filter((placement) => !widgets[placement.contributionId]?.menu);

export const partitionPanelMenus = (input: PartitionPanelMenusInput) => {
  const { areaId, placements, widgets, activeWidgetId, isOpen } = input;
  const tabs = listPanelTabPlacements(placements, widgets);
  const activePanel = tabs.find((placement) => placement.widgetId === activeWidgetId) ?? tabs[0];
  const menus = placements.flatMap((placement): PanelMenuDetails[] => {
    const widget = widgets[placement.contributionId];
    const binding = widget?.menu;
    if (!widget || !binding || (binding.host !== "*" && binding.host !== activePanel?.contributionId)) return [];
    return [{ key: panelMenuOpenKey(areaId, placement.widgetId), binding, placement, widget }];
  });
  const dockedMenus = menus.filter((menu) => isOpen(menu.key));

  return {
    tabs,
    activePanel,
    menus,
    docked: {
      left: dockedMenus.find((menu) => menu.binding.side === "left"),
      right: dockedMenus.find((menu) => menu.binding.side === "right"),
    },
    toggles: menus.filter((menu) => !isOpen(menu.key)),
  };
};
