import type { PluginHelperContext, TicketRef } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

type CreateAttemptHelperInput = TicketRef & {
  repo_id?: string;
  branch?: string;
  prompt?: string;
  agent?: string;
  model?: string;
  mode?: "worktree" | "current_branch";
  base?: string;
};

export const createAttempt = async (ctx: PluginHelperContext, input: CreateAttemptHelperInput) => {
  const ticket = await findTicketByRef(ctx, input);
  if (!ticket) return null;

  const workspace = await ctx.client.workspaces.create({
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
  const session = await ctx.client.sessions.create({
    project_id: ctx.projectId,
    title: ticket.shorthand,
    prompt: input.prompt ?? `Implement ${ticket.shorthand}`,
    workspace_id: workspace.id,
  });

  return { ticket, workspace, session };
};
