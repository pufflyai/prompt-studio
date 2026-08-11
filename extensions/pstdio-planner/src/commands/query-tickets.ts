import { defineCommand } from "@pstdio/sdk/extensions";
import { runTicketsQuery } from "../data/query";
import { loadLatestWorkspaceSessions } from "../data/workspace-sessions";

// Backs the tickets kanban-renderer. The host invokes this per query and re-applies
// filter / sort / group locally, so we return the full visible set.
export const queryTicketsCommand = defineCommand({
  title: "Query tickets",
  async run(ctx) {
    const workspaces = await ctx.workspaces.list();

    return runTicketsQuery({
      storage: ctx.storage,
      projectId: ctx.projectId,
      workspaces,
      workspaceSessions: await loadLatestWorkspaceSessions(ctx.sessions, workspaces),
    });
  },
});
