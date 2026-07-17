import type { Frame, FrameNode, FrameSlot, WorkbenchCore } from "../../core";
import { getActivePlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolvePanelCollapsible, setWorkbenchPanelOpen } from "../workbench/workbench-panel-state";
import { resolveSlotSize } from "./frame-size";
import { isHeaderSlot } from "./frame-tree";

export const useFrameStoreSnapshot = (workbench: WorkbenchCore) => {
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const placeholders = useWorkbenchStore(workbench.layout.store, (state) => state.placeholders);
  const openByAreaId = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId);
  return { layout, placeholders, openByAreaId };
};

type FrameStoreSnapshot = ReturnType<typeof useFrameStoreSnapshot>;

const hasAreaContent = (snapshot: FrameStoreSnapshot, slotId: string) =>
  (snapshot.layout.areas[slotId]?.widgets.length ?? 0) > 0 || Boolean(snapshot.placeholders[slotId]);

const hasCompanionResource = (snapshot: FrameStoreSnapshot, slot: FrameSlot) =>
  !slot.companionOf || Boolean(getActivePlacement(snapshot.layout.areas[slot.companionOf])?.resource);

export const isFrameSlotVisible = (frame: Frame, snapshot: FrameStoreSnapshot, slot: FrameSlot) => {
  if (isHeaderSlot(slot)) return false;
  if (slot.id === "nav") return true;
  if (slot.id === frame.primary) return true;
  return (
    (hasAreaContent(snapshot, slot.id) || hasAreaContent(snapshot, `${slot.id}-header`)) &&
    hasCompanionResource(snapshot, slot)
  );
};

export const isFrameNodeVisible = (frame: Frame, snapshot: FrameStoreSnapshot, node: FrameNode): boolean =>
  node.kind === "slot"
    ? isFrameSlotVisible(frame, snapshot, node)
    : node.children.some((child) => isFrameNodeVisible(frame, snapshot, child));

export const resolveFrameSlotCollapsible = (
  workbench: WorkbenchCore,
  frame: Frame,
  slotId: string,
  headerSlotId = `${slotId}-header`,
) => {
  const areas = frame.slots[headerSlotId] ? [headerSlotId, slotId] : [slotId];
  return resolvePanelCollapsible(workbench, ...areas);
};

export const useFrameSlotState = (workbench: WorkbenchCore, slot: FrameSlot, headerSlot?: FrameSlot) => {
  const snapshot = useFrameStoreSnapshot(workbench);
  const headerSlotId = headerSlot?.id ?? `${slot.id}-header`;
  const frame = workbench.layout.getFrame();
  const collapsible = resolveFrameSlotCollapsible(workbench, frame, slot.id, headerSlotId);
  const open = snapshot.openByAreaId[slot.id] ?? true;

  return {
    has: isFrameSlotVisible(frame, snapshot, slot),
    hasHeader: hasAreaContent(snapshot, headerSlotId),
    placements: snapshot.layout.areas[slot.id]?.widgets ?? [],
    collapsible,
    collapsed: !open && collapsible,
    size: resolveSlotSize(slot, workbench.layout.getAreaSize(slot.id)),
    onOpen: () => setWorkbenchPanelOpen(workbench, slot.id, true),
    onCollapsedChange: (collapsed: boolean) => {
      if (!collapsed || collapsible) setWorkbenchPanelOpen(workbench, slot.id, !collapsed);
    },
  };
};
