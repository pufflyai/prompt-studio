import type { KanbanRendererFilterState } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { runTicketsQuery } from "../data/query";
import { loadLatestWorkspaceSessions } from "../data/workspace-sessions";

// Backs the tickets kanban-renderer. The host invokes this per query and re-applies
// filter / sort / group locally after the planner selects the requested archive set.
export const queryTicketsCommand = defineCommand({
  title: "Query tickets",
  params: {
    filters: params.json<KanbanRendererFilterState>(),
  },
  async run(ctx) {
    const workspaces = await ctx.workspaces.list();

    return runTicketsQuery({
      storage: ctx.storage,
      projectId: ctx.projectId,
      filters: ctx.params.filters,
      workspaces,
      workspaceSessions: await loadLatestWorkspaceSessions(ctx.sessions, workspaces),
    });
  },
});
