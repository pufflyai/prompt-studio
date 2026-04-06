import type { PluginHelperContext, TicketRef } from "./context";
import { workspacesForTicket } from "./workspaces-for-ticket";

export const getAttemptsForTicket = async (ctx: PluginHelperContext, input: TicketRef) => {
  return workspacesForTicket(ctx, input);
};
