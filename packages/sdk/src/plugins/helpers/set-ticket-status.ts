import type { PluginHelperContext } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

type TicketStatusUpdateInput = {
  ticket: string;
  status: string;
};

export const setTicketStatus = async (ctx: PluginHelperContext, input: TicketStatusUpdateInput) => {
  const [ticket, statuses] = await Promise.all([
    findTicketByRef(ctx, { ticketId: input.ticket }),
    ctx.client.statuses.list(ctx.projectId),
  ]);
  if (!ticket) return false;

  const status = statuses.find((candidate) => candidate.name === input.status);
  if (!status) return false;

  await ctx.client.tickets.update(ticket.id, { status_id: status.id });
  return true;
};
