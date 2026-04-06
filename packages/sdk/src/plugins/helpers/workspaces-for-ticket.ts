import type { PluginHelperContext, TicketRef } from "./context";
import { resolveTicketShorthand } from "./find-ticket-by-ref";

export const workspacesForTicket = async (ctx: PluginHelperContext, input: TicketRef) => {
  const ticketShorthand = await resolveTicketShorthand(ctx, input);
  if (!ticketShorthand) return [];

  const workspaces = await ctx.client.workspaces.list(ctx.projectId);
  return workspaces.filter((workspace) => workspace.ticket_shorthand === ticketShorthand);
};
