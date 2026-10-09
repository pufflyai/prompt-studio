// List a milestone's tickets that need a person and step through them from the side panel.
import type { PlanRow } from "../contracts";

export const reviewQueue = (rows: PlanRow[]) =>
  rows.filter(({ flags }) => flags.includes("human-needed")).map(({ id }) => id);

// Stepping wraps around; a ticket that has left the queue restarts at the first one.
export function stepReview(queue: string[], current: string, direction: 1 | -1) {
  const index = queue.indexOf(current);
  if (index < 0) {
    return queue[0];
  }

  return queue[(index + direction + queue.length) % queue.length];
}
