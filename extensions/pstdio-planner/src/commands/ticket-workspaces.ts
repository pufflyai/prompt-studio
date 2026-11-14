import { type CommandContext, defineCommand, type ExtensionWorkspace, params } from "@pstdio/sdk/extensions";
import { linkedWorkspacePage, linkedWorkspacePages, workspaceTicketLinks } from "../data/linked-workspaces";
import { findTicket, requireTickets } from "../data/resolve";
import { plannerOwnerFor } from "../data/ticket-resource-hierarchy";
import { inBatches } from "../data/ticket-selection";

const isGitWorktree = (workspace: ExtensionWorkspace) =>
  workspace.execution_kind === "local" && workspace.provider_id === "pstdio.worktree" && Boolean(workspace.root_path);

const requireExclusiveWorkspace = async (ctx: CommandContext, ws: ExtensionWorkspace, ticketId: string) => {
  for await (const ref of workspaceTicketLinks(ctx, ws.id)) {
    if (
      ref.id !== ticketId ||
      (ref.extensionId && ref.extensionId !== plannerOwnerFor(ctx)) ||
      (ref.projectId && ref.projectId !== ctx.projectId)
    )
      throw new Error(
        `Workspace ${ws.workspace_shorthand ?? ws.id} is linked to other tickets. Unlink it from this ticket before removing its remaining worktrees.`,
      );
  }
};

export const ticketWorkspacesCommand = defineCommand({
  id: "ticket-workspaces",
  title: "List ticket workspaces",
  cli: {
    globalAliases: [["tickets", "workspaces"]],
    examples: ["pstdio pstdio.pstdio-planner ticket-workspaces --id PS-1"],
  },
  params: { id: params.text({ required: true }), cursor: params.text() },
  async run(ctx, commandParams) {
    const tickets = await requireTickets(ctx, commandParams.id);
    const page = await linkedWorkspacePage(ctx, tickets, commandParams.cursor);
    const items: { id: string; workspace: string; branch: string; path: string; active: boolean }[] = [];
    await inBatches(page.items, async (ws) => {
      const active = await ctx.sessions.query({
        workspaceId: ws.id,
        status: ["queued", "in_progress", "awaiting_input"],
        limit: 1,
      });
      items.push({
        id: ws.id,
        workspace: ws.workspace_shorthand ?? ws.id,
        branch: ws.branch ?? "",
        path: ws.root_path ?? "",
        active: active.items.length > 0,
      });
    });
    // Parallel status lookups must not reorder the link page.
    const byId = new Map(items.map((row) => [row.id, row]));
    return { items: page.items.map(({ id }) => byId.get(id)!), nextCursor: page.nextCursor };
  },
});

export const ticketWorktreesListCommand = defineCommand({
  id: "ticket-worktrees-list",
  title: "List ticket worktrees",
  cli: {
    globalAliases: [["tickets", "worktrees", "list"]],
    examples: ["pstdio pstdio.pstdio-planner ticket-worktrees-list --id PS-1"],
  },
  params: { id: params.text({ required: true }), cursor: params.text() },
  async run(ctx, commandParams) {
    const tickets = await requireTickets(ctx, commandParams.id);
    const page = await linkedWorkspacePage(ctx, tickets, commandParams.cursor);
    return {
      items: page.items.filter(isGitWorktree).map((ws) => ({
        workspace: ws.workspace_shorthand ?? ws.id,
        branch: ws.branch ?? "",
        path: ws.root_path ?? "",
      })),
      nextCursor: page.nextCursor,
    };
  },
});

export const ticketWorktreesRemoveAllCommand = defineCommand({
  id: "ticket-worktrees-remove-all",
  mutating: true,
  title: "Remove ticket worktrees",
  cli: {
    globalAliases: [["tickets", "worktrees", "remove-all"]],
    examples: ["pstdio pstdio.pstdio-planner ticket-worktrees-remove-all --id PS-1"],
  },
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    const ticket = await findTicket(ctx, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);
    // Preflight the entire selection without retaining it, before any workspace is removed.
    for await (const page of linkedWorkspacePages(ctx, [ticket])) {
      for (const ws of page.filter(isGitWorktree)) {
        await requireExclusiveWorkspace(ctx, ws, ticket.id);
      }
    }
    let removed = 0;
    for await (const page of linkedWorkspacePages(ctx, [ticket])) {
      for (const ws of page.filter(isGitWorktree)) {
        // Recheck the workspace in case another ticket linked it after preflight.
        await requireExclusiveWorkspace(ctx, ws, ticket.id);
        if ((await ctx.workspaces.removeWorktree(ws.id)).removed) removed++;
      }
    }
    return { removed };
  },
});
