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
  statusToColumnConfig,
  TICKET_ARCHIVE_STATE_ACTIVE,
  TICKET_ARCHIVE_STATE_ARCHIVED,
  TICKET_ARCHIVE_STATE_ATTRIBUTE_ID,
} from "./mappers";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import type { TicketWorkspaceSessionLookup } from "./workspace-sessions";

/** The part of a view's filter rules the query reads: which fields the rules name, at any depth. */
export interface TicketsViewFilter {
  attributeId?: string;
  rules?: TicketsViewFilter[];
}

interface TicketsQueryInput {
  storage: ExtensionStorageApi;
  projectId: string;
  filters?: KanbanRendererFilterState;
  filter?: TicketsViewFilter;
  workspaces?: ExtensionWorkspace[];
  workspaceSessions?: TicketWorkspaceSessionLookup;
}

const namesField = (filter: TicketsViewFilter | undefined, attributeId: string): boolean =>
  filter?.attributeId === attributeId || (filter?.rules ?? []).some((rule) => namesField(rule, attributeId));

// A view rule on the archive state can ask for archived tickets in ways `filters` cannot carry,
// such as "is none of active" or a rule inside an "or" group. Both sets load, and the renderer
// applies the rule.
const defaultArchiveStates = (filter: TicketsViewFilter | undefined) =>
  namesField(filter, TICKET_ARCHIVE_STATE_ATTRIBUTE_ID)
    ? [TICKET_ARCHIVE_STATE_ACTIVE, TICKET_ARCHIVE_STATE_ARCHIVED]
    : [TICKET_ARCHIVE_STATE_ACTIVE];

// The renderer re-applies filter, sort, and grouping locally. The query returns the
// requested archive set and tag schema. Workflow status data comes from the referenced
// status provider, which keeps its storage and board rules in one place.
export const runTicketsQuery = async ({
  storage,
  projectId,
  filters,
  filter,
  workspaces = [],
  workspaceSessions = new Map(),
}: TicketsQueryInput): Promise<KanbanRendererQueryResult> => {
  const [tickets, tags, statuses] = await Promise.all([
    ticketsCollection(storage).list(),
    seedDefaultTags(storage),
    seedDefaultStatuses(storage),
  ]);

  const toTicketRow = createTicketRowMapper(
    projectId,
    tags,
    createTicketWorkspaceLookup(workspaces, workspaceSessions),
    createTicketParentLookup(tickets),
  );
  const selectedArchiveStates = filters?.[TICKET_ARCHIVE_STATE_ATTRIBUTE_ID];
  const requestedArchiveStates = new Set(
    selectedArchiveStates?.length ? selectedArchiveStates : defaultArchiveStates(filter),
  );
  const rows = sortedBySortOrder(
    tickets.filter((ticket) =>
      requestedArchiveStates.has(ticket.archived ? TICKET_ARCHIVE_STATE_ARCHIVED : TICKET_ARCHIVE_STATE_ACTIVE),
    ),
  ).map(toTicketRow);

  return {
    rows,
    attributes: buildTicketAttributes(ticketStatuses.ref, tags),
    boardColumnConfigs: Object.fromEntries(statuses.map((status) => [status.id, statusToColumnConfig(status)])),
  };
};
