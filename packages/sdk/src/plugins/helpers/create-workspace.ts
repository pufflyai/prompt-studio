import type { PluginHelperContext, TicketRef } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

type CreateWorkspaceHelperInput = TicketRef & {
  repo_id?: string;
  branch?: string;
  mode?: "worktree" | "current_branch";
  base?: string;
};

export const createWorkspace = async (ctx: PluginHelperContext, input: CreateWorkspaceHelperInput) => {
  const ticket = await findTicketByRef(ctx, input);
  if (!ticket) return null;

  return ctx.client.workspaces.create({
    project_id: ctx.projectId,
    anchors: [
      {
        type: "pstdio.planner.ticket",
        id: ticket.id,
        label: ticket.shorthand,
        extensionId: "pstdio.planner",
        role: "primary",
      },
    ],
  });
};
