import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { sortedByTicketOrder } from "../utils/sort";
import type { Ticket } from "./types";
import { withWriteGuard } from "./write-guard";

const busy = Symbol("busy");
const ORDER_WAIT_MS = 5_000;
const ORDER_RETRY_MS = 25;

/**
 * Serializes ticket creation with other order writers. Board moves fail fast and
 * the board shows the error, but a create must not fail because a move or another
 * create holds the order for a moment. A live writer retains ownership after the wait.
 */
export const withTicketOrder = async <T>(
  ctx: Pick<ExtensionContextBase, "storage" | "projectId" | "extensionId" | "resources" | "files">,
  write: () => Promise<T>,
) => {
  const deadline = Date.now() + ORDER_WAIT_MS;
  for (;;) {
    const result = await withWriteGuard<T | typeof busy>(ctx, "ticket-order", write, () => busy);
    if (result !== busy) return result;
    if (Date.now() >= deadline) return withWriteGuard(ctx, "ticket-order", write);
    await new Promise((resolve) => setTimeout(resolve, ORDER_RETRY_MS));
  }
};

/** Places a row in the global order, including rows hidden by the current view. */
export const ticketOrderChanges = (
  storage: Pick<ExtensionContextBase["storage"], "positions">,
  tickets: Ticket[],
  rowId: string,
  beforeRowId?: string,
) => {
  const ordered = sortedByTicketOrder(tickets.filter((ticket) => !ticket.archived));
  const moving = ordered.find((ticket) => ticket.id === rowId);
  if (!moving || rowId === beforeRowId) return [];
  const remaining = ordered.filter((ticket) => ticket.id !== rowId);
  const beforeIndex = remaining.findIndex((ticket) => ticket.id === beforeRowId);
  const index = beforeIndex < 0 ? remaining.length : beforeIndex;
  if (ordered.indexOf(moving) === index) return [];
  requireTicketPositions(ordered);
  return [
    { ...moving, position: storage.positions.between(remaining[index - 1]?.position, remaining[index]?.position) },
  ];
};

const requireTicketPositions = (tickets: Ticket[]) => {
  if (tickets.some((ticket) => !ticket.position))
    throw new Error("Ticket order is waiting for the synced Planner update.");
};

export const appendTicketPosition = (storage: ExtensionContextBase["storage"], tickets: Ticket[]) => {
  requireTicketPositions(tickets);
  return storage.positions.between(sortedByTicketOrder(tickets).at(-1)?.position);
};
