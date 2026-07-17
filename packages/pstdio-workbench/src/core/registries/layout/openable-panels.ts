import type { ResourceRef } from "../resources/resource-registry";
import type { Frame } from "./frame-types";
import type { RegisteredWidgetContribution, SlotId, WorkbenchLayout } from "./layout-types";

export interface ListOpenablePanelsInput {
  widgets: readonly RegisteredWidgetContribution[];
  frame: Frame;
  slot: SlotId;
  primary?: ResourceRef;
  layout: WorkbenchLayout;
}

const hasPlacement = (layout: WorkbenchLayout, contributionId: string) =>
  Object.values(layout.areas).some((area) =>
    area.widgets.some((placement) => placement.contributionId === contributionId),
  );

export const isPanelSlot = (frame: Frame, slot: SlotId) =>
  slot !== frame.primary && frame.slots[slot]?.role === "panels";

export const listOpenablePanels = (input: ListOpenablePanelsInput) => {
  const { widgets, frame, slot, primary, layout } = input;
  if (!isPanelSlot(frame, slot)) return [];

  return widgets.filter((widget) => {
    if (widget.openable !== true || widget.area !== slot) return false;
    if (widget.resourceKinds && !widget.resourceKinds.includes(primary?.kind ?? "")) return false;
    return widget.singleton !== true || !hasPlacement(layout, widget.id);
  });
};
