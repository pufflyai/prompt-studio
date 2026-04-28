import type { PluginHelperContext, TicketRef } from "./context";
import { workspacesForTicket } from "./workspaces-for-ticket";

export const removeAllWorktreesForTicket = async (ctx: PluginHelperContext, input: TicketRef) => {
  const ticketWorkspaces = (await workspacesForTicket(ctx, input)).filter((workspace) => workspace.worktree_path);

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
