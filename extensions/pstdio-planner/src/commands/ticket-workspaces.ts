import { defineCommand, type ExtensionWorkspace, params } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";
import { isWorkspaceLinkedToTicket } from "../data/workspace-ticket-link";
import { isLiveSessionStatus } from "../session-status";

const workspacesForTicket = async (
  ctx: { workspaces: { list(): Promise<ExtensionWorkspace[]> }; storage: Parameters<typeof findTicket>[0] },
  id: string,
) => {
  const ticket = await findTicket(ctx.storage, id);
  if (!ticket) throw new Error(`Unknown ticket "${id}"`);
  const workspaces = (await ctx.workspaces.list()).filter((ws) => isWorkspaceLinkedToTicket(ws, ticket.shorthand));
  return { ticket, workspaces };
};

// `pst tickets workspaces`: list the workspaces linked to a ticket with their live
// activity, derived from anchored sessions.
export const ticketWorkspacesCommand = defineCommand({
  title: "List ticket workspaces",
  cli: { globalAliases: [["tickets", "workspaces"]], examples: ["pstdio tickets workspaces --id PS-1"] },
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    const { workspaces } = await workspacesForTicket(ctx, commandParams.id);
    const rows = [];
    for (const ws of workspaces) {
      const sessions = await ctx.sessions.listByWorkspace(ws.id);
      rows.push({
        id: ws.id,
        workspace: ws.workspace_shorthand ?? ws.id,
        branch: ws.branch ?? "",
        path: ws.worktree_path ?? "",
        active: sessions.some((session) => isLiveSessionStatus(session.status)),
      });
    }
    return rows;
  },
});

// `pst tickets worktrees list`: list the worktrees (workspaces with a worktree path)
// linked to a ticket.
export const ticketWorktreesListCommand = defineCommand({
  title: "List ticket worktrees",
  cli: { globalAliases: [["tickets", "worktrees", "list"]], examples: ["pstdio tickets worktrees list --id PS-1"] },
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    const { workspaces } = await workspacesForTicket(ctx, commandParams.id);
    return workspaces
      .filter((ws) => ws.worktree_path)
      .map((ws) => ({
        workspace: ws.workspace_shorthand ?? ws.id,
        branch: ws.branch ?? "",
        path: ws.worktree_path ?? "",
      }));
  },
});

// `pst tickets worktrees remove-all`: remove every worktree (and its branch) linked
// to a ticket. Git work runs in the API via the host process capability.
export const ticketWorktreesRemoveAllCommand = defineCommand({
  title: "Remove ticket worktrees",
  cli: {
    globalAliases: [["tickets", "worktrees", "remove-all"]],
    examples: ["pstdio tickets worktrees remove-all --id PS-1"],
  },
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    const repoPath = ctx.repo?.path;
    if (!repoPath) throw new Error("This command must be run inside a project repository.");

    const { workspaces } = await workspacesForTicket(ctx, commandParams.id);
    const worktrees = workspaces.filter((ws) => ws.worktree_path);

    let removed = 0;
    for (const ws of worktrees) {
      const branch = ws.branch ?? `workspace/${ws.workspace_shorthand ?? ws.id}`;
      const result = await ctx.process.run({
        command: ["git", "-C", repoPath, "worktree", "remove", "--force", ws.worktree_path as string],
      });
      if (result.exitCode !== 0) continue;
      await ctx.process.run({ command: ["git", "-C", repoPath, "branch", "-D", branch] });
      removed += 1;
    }

    return { removed };
  },
});
