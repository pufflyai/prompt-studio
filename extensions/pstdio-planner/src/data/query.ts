import type {
  ExtensionStorageApi,
  ExtensionWorkspace,
  KanbanRendererFilterState,
  KanbanRendererQueryResult,
} from "@pstdio/sdk/extensions";
import { ticketStatuses } from "../ticket-status-provider";
import { sortedBySortOrder } from "../utils/sort";
import { ticketsCollection } from "./collections";
import {
  buildTicketAttributes,
  createTicketParentLookup,
  createTicketRowMapper,
  createTicketWorkspaceLookup,
  TICKET_ARCHIVE_STATE_ACTIVE,
  TICKET_ARCHIVE_STATE_ARCHIVED,
  TICKET_ARCHIVE_STATE_ATTRIBUTE_ID,
} from "./mappers";
import { seedDefaultTags } from "./seed";
import type { TicketWorkspaceSessionLookup } from "./workspace-sessions";

interface TicketsQueryInput {
  storage: ExtensionStorageApi;
  projectId: string;
  filters?: KanbanRendererFilterState;
  workspaces?: ExtensionWorkspace[];
  workspaceSessions?: TicketWorkspaceSessionLookup;
}

// The renderer re-applies filter, sort, and grouping locally. The query returns the
// requested archive set and tag schema. Workflow status data comes from the referenced
// status provider, which keeps its storage and board rules in one place.
export const runTicketsQuery = async ({
  storage,
  projectId,
  filters,
  workspaces = [],
  workspaceSessions = new Map(),
}: TicketsQueryInput): Promise<KanbanRendererQueryResult> => {
  const [tickets, tags] = await Promise.all([ticketsCollection(storage).list(), seedDefaultTags(storage)]);

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
    attributes: buildTicketAttributes(ticketStatuses.ref, tags),
  };
};
