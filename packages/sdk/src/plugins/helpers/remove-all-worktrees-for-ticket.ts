import type { PluginHelperContext, TicketRef } from "./context";
import { resolveTicketShorthand } from "./find-ticket-by-ref";

export const removeAllWorktreesForTicket = async (ctx: PluginHelperContext, input: TicketRef) => {
  const ticketShorthand = await resolveTicketShorthand(ctx, input);
  if (!ticketShorthand) return 0;

  const workspaces = await ctx.client.workspaces.list(ctx.projectId);
  const ticketWorkspaces = workspaces.filter(
    (workspace) => workspace.ticket_shorthand === ticketShorthand && workspace.worktree_path,
  );

  let removed = 0;
  for (const workspace of ticketWorkspaces) {
    try {
      const result = await ctx.client.workspaces.removeWorktree(workspace.id);
      if (result.removed) {
        removed++;
      }
    } catch {
      // Best-effort cleanup to match CLI remove-all behavior.
    }
  }

  return removed;
};
