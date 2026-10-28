import type {
  ExtensionStorageApi,
  ExtensionWorkspace,
  KanbanRendererQueryResult,
  ViewFilterGroup,
} from "@pstdio/sdk/extensions";
import { attentionPanelTarget } from "../attention-panel";
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
import { hasPendingInput, readTicketReviewRequests } from "./review-request-storage";
import { REVIEW_REQUEST_ITEMS_ATTRIBUTE, reviewRequestBadgeItems } from "./review-request-summary";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import type { TicketContext } from "./ticket-identity";
import { ticketActivationTarget } from "./ticket-page-target";
import { emptyWorkflowStatuses, type WorkflowStatusSelections } from "./workflow-statuses";
import type { TicketWorkspaceSessionLookup } from "./workspace-sessions";

interface TicketsQueryInput {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  projectId: string;
  workflow?: WorkflowStatusSelections;
  filter?: ViewFilterGroup;
  workspaces?: ExtensionWorkspace[];
  workspaceSessions?: TicketWorkspaceSessionLookup;
}

// The renderer re-applies filter, sort, and grouping locally. The query returns the
// requested archive set, enum options, and board rules from Planner storage.
export const runTicketsQuery = async ({
  storage,
  resources,
  projectId,
  filter,
  workflow = emptyWorkflowStatuses(),
  workspaces = [],
  workspaceSessions = new Map(),
}: TicketsQueryInput): Promise<KanbanRendererQueryResult> => {
  const [tickets, tags, statuses, storedPlan, requests] = await Promise.all([
    ticketsCollection({ storage, resources }).list(),
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
      workflow,
      plan: resolvePlan(storedPlan, activeTickets, statuses, workflow),
      today: new Intl.DateTimeFormat("en-CA").format(new Date()),
    }),
  );

  const toTicketRow = createTicketRowMapper(
    projectId,
    tags,
    createTicketWorkspaceLookup(workspaces, workspaceSessions),
    createTicketParentLookup(tickets),
  );
  const archiveRule =
    filter?.conjunction === "and"
      ? filter.rules.find(
          (rule) => rule.attributeId === TICKET_ARCHIVE_STATE_ATTRIBUTE_ID && rule.condition === "is-any-of",
        )
      : undefined;
  const selectedArchiveStates = Array.isArray(archiveRule?.value) ? archiveRule.value : undefined;
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
      target: ticketActivationTarget(
        row.resource,
        hasPendingInput(requests.get(ticket.id) ?? { requests: [], errors: [] }),
      ),
      attributes: {
        ...row.attributes,
        ...(timeline.values.get(ticket.id) ?? {
          milestone: "",
          milestoneDate: null,
          milestoneState: "unscheduled",
          needsAttention: "no",
        }),
        [REVIEW_REQUEST_ITEMS_ATTRIBUTE]: reviewRequestBadgeItems(
          requests.get(ticket.id) ?? { requests: [], errors: [] },
          attentionPanelTarget(row.resource),
        ),
      },
    };
  });

  return {
    rows,
    attributes: [...buildTicketAttributes(statuses, tags), ...timeline.attributes],
    boardColumnConfigs: Object.fromEntries(statuses.map((status) => [status.id, statusToColumnConfig(status)])),
  };
};
