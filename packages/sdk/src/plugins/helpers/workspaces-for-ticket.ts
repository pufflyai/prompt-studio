import type { PluginHelperContext, TicketRef } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

const hasPlannerTicketAnchor = (workspace: { anchors_json?: unknown }, ticketId: string, shorthand: string) =>
  Array.isArray(workspace.anchors_json) &&
  workspace.anchors_json.some((anchor) => {
    if (!anchor || typeof anchor !== "object") return false;
    const ref = anchor as { type?: unknown; id?: unknown; label?: unknown };
    return (
      ref.type === "pstdio.planner.ticket" && (ref.id === ticketId || ref.id === shorthand || ref.label === shorthand)
    );
  });

export const workspacesForTicket = async (ctx: PluginHelperContext, input: TicketRef) => {
  const ticket = await findTicketByRef(ctx, input);
  if (!ticket) return [];

  const workspaces = await ctx.client.workspaces.list(ctx.projectId);
  return workspaces.filter((workspace) => hasPlannerTicketAnchor(workspace, ticket.id, ticket.shorthand));
};
