import type { PluginHelperContext } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";
import { executePlannerCommand, listPlannerStatuses } from "./planner";

type TicketStatusUpdateInput = {
  ticket: string;
  status: string;
};

export const setTicketStatus = async (ctx: PluginHelperContext, input: TicketStatusUpdateInput) => {
  const [ticket, statuses] = await Promise.all([
    findTicketByRef(ctx, { ticketId: input.ticket }),
    listPlannerStatuses(ctx),
  ]);
  if (!ticket) return false;

  const status = statuses.find((candidate) => candidate.name === input.status);
  if (!status) return false;

  await executePlannerCommand(ctx, "pstdio.planner.updateTicket", { ticket_id: ticket.id, status_id: status.id });
  return true;
};
