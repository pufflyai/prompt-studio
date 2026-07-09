import type { QueuedFollowUp } from "./message-types";

export type QueuedFollowUpMoveDirection = "up" | "down";

export const moveQueuedFollowUp = (
  items: QueuedFollowUp[],
  itemId: string,
  direction: QueuedFollowUpMoveDirection,
  steps = 1,
) => {
  let nextItems = items;

  for (let step = 0; step < steps; step += 1) {
    const movedItems = moveQueuedFollowUpOneSlot(nextItems, itemId, direction);
    if (movedItems === nextItems) return nextItems;
    nextItems = movedItems;
  }

  return nextItems;
};

const moveQueuedFollowUpOneSlot = (items: QueuedFollowUp[], itemId: string, direction: QueuedFollowUpMoveDirection) => {
  const currentIndex = items.findIndex((item) => item.id === itemId);
  if (currentIndex === -1) return items;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;

  const nextItems = [...items];
  const currentItem = nextItems[currentIndex]!;
  nextItems[currentIndex] = nextItems[targetIndex]!;
  nextItems[targetIndex] = currentItem;
  return nextItems;
};

export const reorderQueuedFollowUp = (items: QueuedFollowUp[], itemId: string, targetIndex: number) => {
  const currentIndex = items.findIndex((item) => item.id === itemId);
  if (currentIndex === -1 || currentIndex === targetIndex) return items;
  if (targetIndex < 0 || targetIndex >= items.length) return items;

  const direction: QueuedFollowUpMoveDirection = targetIndex < currentIndex ? "up" : "down";
  return moveQueuedFollowUp(items, itemId, direction, Math.abs(targetIndex - currentIndex));
};
