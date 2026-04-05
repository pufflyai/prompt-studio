import { firstMatch, type PluginHelperContext, readTicketFromContext, type TicketRef } from "./context";

export const findTicketByRef = async (ctx: PluginHelperContext, input: TicketRef) => {
  const contextualTicket = readTicketFromContext(ctx, input.ticketId);
  if (contextualTicket) return contextualTicket;

  const tickets = await ctx.client.tickets.list(ctx.projectId);
  return firstMatch(tickets, input.ticketId, (ticket) => ticket.shorthand);
};

export const resolveTicketShorthand = async (ctx: PluginHelperContext, input: TicketRef) => {
  if (!input.ticketId) return null;

  const ticket = await findTicketByRef(ctx, input);
  return ticket?.shorthand ?? null;
};
