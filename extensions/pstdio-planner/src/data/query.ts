import type {
  ExtensionStorageApi,
  ExtensionWorkspace,
  KanbanRendererFilterState,
  KanbanRendererQueryResult,
} from "@pstdio/sdk/extensions";
import { ticketStatuses } from "../ticket-status-provider";
import { readStoredPlan } from "../timeline/commands/plan-store";
import { buildPlan } from "../timeline/model/build-plan";
import { resolvePlan } from "../timeline/model/resolve-plan";
import { timelineTicketProperties } from "../timeline/model/ticket-properties";
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
import { readTicketReviewRequests } from "./review-request-storage";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
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
  const [tickets, tags, statuses, storedPlan, requests] = await Promise.all([
    ticketsCollection(storage).list(),
    seedDefaultTags(storage),
    seedDefaultStatuses(storage),
    readStoredPlan(storage),
    readTicketReviewRequests(storage),
  ]);
  const activeTickets = sortedBySortOrder(tickets.filter((ticket) => !ticket.archived));
  const timeline = timelineTicketProperties(
    buildPlan({
      tickets: activeTickets,
      tags,
      statuses,
      requests,
      plan: resolvePlan(storedPlan, activeTickets, statuses),
      today: new Intl.DateTimeFormat("en-CA").format(new Date()),
    }),
  );

  const toTicketRow = createTicketRowMapper(
    projectId,
    tags,
    createTicketWorkspaceLookup(workspaces, workspaceSessions),
    createTicketParentLookup(tickets),
  );
  const selectedArchiveStates = filters?.[TICKET_ARCHIVE_STATE_ATTRIBUTE_ID];
  const requestedArchiveStates = new Set(
    selectedArchiveStates?.length
      ? selectedArchiveStates
      : [TICKET_ARCHIVE_STATE_ACTIVE, TICKET_ARCHIVE_STATE_ARCHIVED],
  );
  const rows = sortedBySortOrder(
    tickets.filter((ticket) =>
      requestedArchiveStates.has(ticket.archived ? TICKET_ARCHIVE_STATE_ARCHIVED : TICKET_ARCHIVE_STATE_ACTIVE),
    ),
  ).map((ticket) => {
    const row = toTicketRow(ticket);
    return {
      ...row,
      attributes: {
        ...row.attributes,
        ...(timeline.values.get(ticket.id) ?? {
          milestone: "",
          milestoneDate: null,
          milestoneState: "unscheduled",
          needsAttention: "no",
        }),
      },
    };
  });

  return {
    rows,
    attributes: [...buildTicketAttributes(ticketStatuses.ref, tags), ...timeline.attributes],
    boardColumnConfigs: Object.fromEntries(statuses.map((status) => [status.id, statusToColumnConfig(status)])),
  };
};
