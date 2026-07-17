import type { Frame, FrameNode, FrameSlot, WorkbenchCore } from "../../core";
import { getActivePlacement } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { resolvePanelCollapsible, setWorkbenchPanelOpen } from "../workbench/workbench-panel-state";
import { resolveSlotSize } from "./frame-size";

export const useFrameStoreSnapshot = (workbench: WorkbenchCore) => {
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const placeholders = useWorkbenchStore(workbench.layout.store, (state) => state.placeholders);
  const openByAreaId = useWorkbenchStore(workbench.panels.store, (state) => state.openByAreaId);
  return { layout, placeholders, openByAreaId };
};

export type FrameStoreSnapshot = ReturnType<typeof useFrameStoreSnapshot>;

const hasAreaContent = (snapshot: FrameStoreSnapshot, slotId: string) =>
  (snapshot.layout.areas[slotId]?.widgets.length ?? 0) > 0 || Boolean(snapshot.placeholders[slotId]);

const hasCompanionResource = (snapshot: FrameStoreSnapshot, slot: FrameSlot) =>
  !slot.companionOf || Boolean(getActivePlacement(snapshot.layout.areas[slot.companionOf])?.resource);

export const isFrameSlotVisible = (frame: Frame, snapshot: FrameStoreSnapshot, slot: FrameSlot) => {
  if (slot.id === "nav") return true;
  if (slot.id === frame.primary) return true;
  return hasAreaContent(snapshot, slot.id) && hasCompanionResource(snapshot, slot);
};

export const isFrameNodeVisible = (frame: Frame, snapshot: FrameStoreSnapshot, node: FrameNode): boolean =>
  node.kind === "slot"
    ? isFrameSlotVisible(frame, snapshot, node)
    : node.children.some((child) => isFrameNodeVisible(frame, snapshot, child));

export const resolveFrameSlotCollapsible = (
  workbench: WorkbenchCore,
  _frame: Frame,
  slotId: string,
  _headerSlotId?: string,
) => resolvePanelCollapsible(workbench, slotId);

export const resolveFrameSlotState = (workbench: WorkbenchCore, slot: FrameSlot, snapshot: FrameStoreSnapshot) => {
  const frame = workbench.layout.getFrame();
  const collapsible = resolveFrameSlotCollapsible(workbench, frame, slot.id);
  const open = snapshot.openByAreaId[slot.id] ?? true;

  return {
    has: isFrameSlotVisible(frame, snapshot, slot),
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

export const useFrameSlotState = (workbench: WorkbenchCore, slot: FrameSlot) =>
  resolveFrameSlotState(workbench, slot, useFrameStoreSnapshot(workbench));
