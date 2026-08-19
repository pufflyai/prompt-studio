import type {
  ExtensionStorageApi,
  ExtensionWorkspace,
  KanbanRendererFilterState,
  KanbanRendererQueryResult,
} from "@pstdio/sdk/extensions";
import { sortedBySortOrder } from "../utils/sort";
import { ticketsCollection } from "./collections";
import {
  buildTicketAttributes,
  createTicketParentLookup,
  createTicketRowMapper,
  createTicketWorkspaceLookup,
  statusToColumnConfig,
  TICKET_ARCHIVE_STATE_ACTIVE,
  TICKET_ARCHIVE_STATE_ARCHIVED,
  TICKET_ARCHIVE_STATE_ATTRIBUTE_ID,
} from "./mappers";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import type { TicketWorkspaceSessionLookup } from "./workspace-sessions";

interface TicketsQueryInput {
  storage: ExtensionStorageApi;
  projectId: string;
  filters?: KanbanRendererFilterState;
  workspaces?: ExtensionWorkspace[];
  workspaceSessions?: TicketWorkspaceSessionLookup;
}

// The renderer re-applies filter / sort / group locally, so we return the
// requested archive set plus the live status + tag schema and board config.
// Statuses and tags are seeded lazily here so a freshly enabled project always has
// board columns and tag attributes regardless of the install-time lifecycle scope.
export const runTicketsQuery = async ({
  storage,
  projectId,
  filters,
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
  const selectedArchiveStates = filters?.[TICKET_ARCHIVE_STATE_ATTRIBUTE_ID];
  const requestedArchiveStates = new Set(
    selectedArchiveStates?.length ? selectedArchiveStates : [TICKET_ARCHIVE_STATE_ACTIVE],
  );
  const rows = sortedBySortOrder(
    tickets.filter((ticket) =>
      requestedArchiveStates.has(ticket.archived ? TICKET_ARCHIVE_STATE_ARCHIVED : TICKET_ARCHIVE_STATE_ACTIVE),
    ),
  ).map(toTicketRow);

  return {
    rows,
    attributes: buildTicketAttributes(sortedStatuses, tags),
    boardColumnConfigs: Object.fromEntries(sortedStatuses.map((status) => [status.id, statusToColumnConfig(status)])),
  };
};
