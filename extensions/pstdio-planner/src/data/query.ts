import type { ExtensionStorageApi, ExtensionWorkspace, KanbanRendererQueryResult } from "@pstdio/sdk/extensions";
import { sortedBySortOrder } from "../utils/sort";
import { ticketsCollection } from "./collections";
import {
  buildTicketAttributes,
  createTicketParentLookup,
  createTicketRowMapper,
  createTicketWorkspaceLookup,
  statusToColumnConfig,
} from "./mappers";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import type { TicketWorkspaceSessionLookup } from "./workspace-sessions";

interface TicketsQueryInput {
  storage: ExtensionStorageApi;
  projectId: string;
  workspaces?: ExtensionWorkspace[];
  workspaceSessions?: TicketWorkspaceSessionLookup;
}

// The renderer re-applies filter / sort / group locally, so we return every
// visible ticket plus the live status + tag schema and per-column board config.
// Statuses and tags are seeded lazily here so a freshly enabled project always has
// board columns and tag attributes regardless of the install-time lifecycle scope.
export const runTicketsQuery = async ({
  storage,
  projectId,
  workspaces = [],
  workspaceSessions = new Map(),
}: TicketsQueryInput): Promise<KanbanRendererQueryResult> => {
  const [tickets, statuses, tags] = await Promise.all([
    ticketsCollection(storage).list(),
    seedDefaultStatuses(storage),
    seedDefaultTags(storage),
  ]);

  const sortedStatuses = sortedBySortOrder(statuses);
  const toTicketRow = createTicketRowMapper(
    projectId,
    tags,
    createTicketWorkspaceLookup(workspaces, workspaceSessions),
    createTicketParentLookup(tickets),
  );
  const rows = sortedBySortOrder(tickets.filter((ticket) => !ticket.archived)).map(toTicketRow);

  return {
    rows,
    attributes: buildTicketAttributes(sortedStatuses, tags),
    boardColumnConfigs: Object.fromEntries(sortedStatuses.map((status) => [status.id, statusToColumnConfig(status)])),
  };
};
