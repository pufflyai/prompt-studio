import type { ExtensionContextBase, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { runTicketsQuery } from "../data/query";
import { readMigratedTickets } from "../data/read-migrated-tickets";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";

export const queryTickets = async (
  ctx: Pick<ExtensionContextBase, "files" | "projectId" | "storage" | "settings" | "resources" | "extensionId">,
  input: { filter?: ViewFilterGroup },
) => {
  const tickets = await readMigratedTickets(ctx);

  return runTicketsQuery({
    tickets,
    storage: ctx.storage,
    resources: ctx.resources,
    projectId: ctx.projectId,
    extensionId: ctx.extensionId === "pstdio.pstdio-planner" ? ctx.extensionId : "pstdio.planner",
    workflow: usableWorkflowStatuses(await readWorkflowStatuses(ctx)),
    filter: input.filter,
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
