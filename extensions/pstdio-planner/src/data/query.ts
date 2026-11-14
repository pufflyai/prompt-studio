import type { ExtensionStorageApi, KanbanRendererQueryResult, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { attentionPanelTarget } from "../attention-panel";
import { readStoredPlan } from "../timeline/commands/plan-store";
import { buildPlan } from "../timeline/model/build-plan";
import { resolvePlan } from "../timeline/model/resolve-plan";
import { timelineTicketProperties } from "../timeline/model/ticket-properties";
import { sortedByTicketOrder } from "../utils/sort";
import { ticketsCollection } from "./collections";
import {
  buildTicketAttributes,
  createTicketParentLookup,
  createTicketRowMapper,
  statusToColumnConfig,
  TICKET_ARCHIVE_STATE_ACTIVE,
  TICKET_ARCHIVE_STATE_ARCHIVED,
  TICKET_ARCHIVE_STATE_ATTRIBUTE_ID,
} from "./mappers";
import { readTicketReviewRequests } from "./review-request-storage";
import { REVIEW_REQUEST_ITEMS_ATTRIBUTE, reviewRequestBadgeItems } from "./review-request-summary";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import type { TicketContext } from "./ticket-identity";
import { loadTicketLinkedResources } from "./ticket-linked-resources";
import { ticketPageTarget } from "./ticket-page-target";
import type { Ticket } from "./types";
import { emptyWorkflowStatuses, type WorkflowStatusSelections } from "./workflow-statuses";

interface TicketsQueryInput {
  extensionId?: string;
  tickets?: Ticket[];
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  projectId: string;
  workflow?: WorkflowStatusSelections;
  filter?: ViewFilterGroup;
}

// The renderer re-applies filter, sort, and grouping locally. The query returns the
// requested archive set, enum options, and board rules from Planner storage.
export const runTicketsQuery = async ({
  tickets: snapshot,
  storage,
  resources,
  projectId,
  extensionId = "pstdio.pstdio-planner",
  filter,
  workflow = emptyWorkflowStatuses(),
}: TicketsQueryInput): Promise<KanbanRendererQueryResult> => {
  const [tickets, tags, statuses, storedPlan, requests] = await Promise.all([
    snapshot ?? ticketsCollection({ storage, resources }).list(),
    seedDefaultTags(storage),
    seedDefaultStatuses(storage),
    readStoredPlan(storage),
    readTicketReviewRequests(storage),
  ]);
  const activeTickets = sortedByTicketOrder(tickets.filter((ticket) => !ticket.archived));
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
  const visibleTickets = sortedByTicketOrder(
    tickets.filter((ticket) =>
      requestedArchiveStates.has(ticket.archived ? TICKET_ARCHIVE_STATE_ARCHIVED : TICKET_ARCHIVE_STATE_ACTIVE),
    ),
  );

  const toTicketRow = createTicketRowMapper(
    projectId,
    tags,
    await loadTicketLinkedResources(
      resources,
      visibleTickets.map((ticket) => ({
        type: "ticket",
        id: ticket.id,
        extensionId,
        projectId,
      })),
    ),
    createTicketParentLookup(tickets),
    extensionId,
  );
  const rows = visibleTickets.map((ticket) => {
    const row = toTicketRow(ticket);
    return {
      ...row,
      target: ticketPageTarget(row.resource),
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
