import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { statusesCollection, ticketsCollection } from "./collections";
import { findTicket } from "./resolve";

// Conventional names for the in-progress board column, tried in order.
const IN_PROGRESS_NAMES = ["In Progress", "wip"];

// Publish the saved status so open Planner views refresh when an attempt starts.
export const moveTicketToInProgress = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events">,
  ticketRef: string,
) => {
  const { storage, events } = ctx;
  const ticket = await findTicket(storage, ticketRef);
  if (!ticket) return;
  const statuses = await statusesCollection(storage).list();
  for (const name of IN_PROGRESS_NAMES) {
    const status = statuses.find((status) => status.name.trim().toLowerCase() === name.toLowerCase());
    if (!status) continue;
    if (ticket.statusId === status.id) return;
    await ticketsCollection(storage).put(ticket.id, {
      ...ticket,
      statusId: status.id,
      updatedAt: new Date().toISOString(),
    });
    await events.emit(plannerTicketsChanged, { ticketId: ticket.id });
    return;
  }
};
