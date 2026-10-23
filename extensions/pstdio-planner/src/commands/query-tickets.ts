import type { ExtensionContextBase, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { migratePlannerStorage } from "../data/migrate-storage";
import { runTicketsQuery } from "../data/query";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { loadLatestWorkspaceSessions } from "../data/workspace-sessions";

export const queryTickets = async (
  ctx: Pick<ExtensionContextBase, "files" | "projectId" | "sessions" | "storage" | "workspaces" | "settings">,
  input: { filter?: ViewFilterGroup },
) => {
  await migratePlannerStorage(ctx);
  const workspaces = await ctx.workspaces.list();

  return runTicketsQuery({
    storage: ctx.storage,
    projectId: ctx.projectId,
    workflow: usableWorkflowStatuses(await readWorkflowStatuses(ctx)),
    filter: input.filter,
    workspaces,
    workspaceSessions: await loadLatestWorkspaceSessions(ctx.sessions, workspaces),
  });
};

// Backs the tickets kanban-renderer. The host invokes this per query and re-applies
// filter / sort / group locally after the planner selects the requested archive set.
export const queryTicketsCommand = defineCommand({
  id: "query-tickets",
  title: "Query tickets",
  params: {
    filter: params.json<ViewFilterGroup>(),
  },
  run: queryTickets,
});
