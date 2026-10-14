import { sortedBySortOrder } from "../utils/sort";
import type { StoredTicket } from "./types";

/** Places a row in the global order, including rows hidden by the current view. */
export const ticketOrderChanges = (tickets: StoredTicket[], rowId: string, beforeRowId?: string) => {
  const ordered = sortedBySortOrder(tickets.filter((ticket) => !ticket.archived));
  const moving = ordered.find((ticket) => ticket.id === rowId);
  if (!moving || rowId === beforeRowId) return [];
  const remaining = ordered.filter((ticket) => ticket.id !== rowId);
  const beforeIndex = remaining.findIndex((ticket) => ticket.id === beforeRowId);
  const index = beforeIndex < 0 ? remaining.length : beforeIndex;
  if (ordered.indexOf(moving) === index) return [];
  const left = remaining[index - 1]?.sortOrder;
  const right = remaining[index]?.sortOrder;
  let position = 0;
  if (left === undefined && right !== undefined) position = right - 1;
  else if (right === undefined && left !== undefined) position = left + 1;
  else if (left !== undefined && right !== undefined) position = left / 2 + right / 2;
  if (
    Number.isFinite(position) &&
    (left === undefined || left < position) &&
    (right === undefined || position < right)
  ) {
    return [{ ...moving, sortOrder: position }];
  }
  // Floating-point gaps eventually run out. Rebalance only changed positions
  // in the complete active order; archived and filtered-out membership stay intact.
  const next = [...remaining.slice(0, index), moving, ...remaining.slice(index)];
  return next.flatMap((ticket, sortOrder) => (ticket.sortOrder === sortOrder ? [] : [{ ...ticket, sortOrder }]));
};
