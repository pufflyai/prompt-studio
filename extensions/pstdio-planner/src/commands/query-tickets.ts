import type { ExtensionContextBase, KanbanRendererFilterState } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { runTicketsQuery } from "../data/query";
import { loadLatestWorkspaceSessions } from "../data/workspace-sessions";

export const queryTickets = async (
  ctx: Pick<ExtensionContextBase, "projectId" | "sessions" | "storage" | "workspaces">,
  input: { filters?: KanbanRendererFilterState },
) => {
  const workspaces = await ctx.workspaces.list();

  return runTicketsQuery({
    storage: ctx.storage,
    projectId: ctx.projectId,
    filters: input.filters,
    workspaces,
    workspaceSessions: await loadLatestWorkspaceSessions(ctx.sessions, workspaces),
  });
};

// Backs the tickets kanban-renderer. The host invokes this per query and re-applies
// filter / sort / group locally after the planner selects the requested archive set.
export const queryTicketsCommand = defineCommand({
  title: "Query tickets",
  params: {
    filters: params.json<KanbanRendererFilterState>(),
  },
  run: queryTickets,
});
