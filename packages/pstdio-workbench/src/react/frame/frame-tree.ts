import type { Frame, FrameNode, FrameSlot } from "../../core";

export const listFrameSlots = (node: FrameNode): FrameSlot[] => {
  if (node.kind === "slot") return [node];
  return node.children.flatMap(listFrameSlots);
};

export const containsFrameSlot = (node: FrameNode, slotId: string): boolean =>
  node.kind === "slot" ? node.id === slotId : node.children.some((child) => containsFrameSlot(child, slotId));

export const resolveResizableSlot = (node: FrameNode) => {
  const slots = listFrameSlots(node);
  return slots.length === 1 ? slots[0] : undefined;
};

export const resolveMainFrameNode = (frame: Frame) => {
  const optionalSlotIds = [frame.secondary?.slot].filter((slotId): slotId is string => Boolean(slotId));
  const requiredSlotIds = [frame.primary, ...optionalSlotIds];

  const descend = (node: FrameNode): FrameNode => {
    if (node.kind === "slot") return node;
    const containingChild = node.children.find((child) =>
      requiredSlotIds.every((slotId) => containsFrameSlot(child, slotId)),
    );
    return containingChild ? descend(containingChild) : node;
  };

  return descend(frame.root);
};
