import type { ExtensionStorageApi, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { makeCommandContext } from "../commands/command-context.fixture";
import { queryTicketPage } from "./query-ticket-page";
import type { TicketContext } from "./ticket-identity";
import { emptyWorkflowStatuses, type WorkflowStatusSelections } from "./workflow-statuses";

// Exercise the production Board provider with the existing behavior fixtures.
export const runTicketsQuery = async (input: {
  extensionId?: string;
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  projectId: string;
  workflow?: WorkflowStatusSelections;
  filter?: ViewFilterGroup;
}) => {
  const ctx = makeCommandContext({
    storage: input.storage,
    projectId: input.projectId,
    params: {},
    overrides: {
      extensionId: input.extensionId ?? "pstdio-planner",
      resources: input.resources,
      settings: { all: async () => ({ "workflow.statuses": input.workflow ?? emptyWorkflowStatuses() }) },
    },
  });
  return queryTicketPage(ctx, { filter: input.filter });
};
