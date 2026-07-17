import type { Frame, FrameNode, FrameSlot } from "../../core";

type HeaderFrameSlot = FrameSlot & { id: `${string}-header` };

export const isHeaderSlot = (node: FrameNode): node is HeaderFrameSlot =>
  node.kind === "slot" && node.id.endsWith("-header");

export const resolveHeaderTargetId = (slot: FrameSlot) => slot.id.slice(0, -"-header".length);

export const listFrameSlots = (node: FrameNode): FrameSlot[] => {
  if (node.kind === "slot") return [node];
  return node.children.flatMap(listFrameSlots);
};

export const containsFrameSlot = (node: FrameNode, slotId: string): boolean =>
  node.kind === "slot" ? node.id === slotId : node.children.some((child) => containsFrameSlot(child, slotId));

export const resolveResizableSlot = (node: FrameNode) => {
  const contentSlots = listFrameSlots(node).filter((slot) => !isHeaderSlot(slot));
  return contentSlots.length === 1 ? contentSlots[0] : undefined;
};

export const resolveMainFrameNode = (frame: Frame) => {
  const optionalSlotIds = [`${frame.primary}-header`, frame.secondary?.slot].filter((slotId): slotId is string =>
    Boolean(slotId && frame.slots[slotId]),
  );
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
