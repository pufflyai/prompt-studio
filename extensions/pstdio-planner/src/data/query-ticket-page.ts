import { readCollectionPage } from "@pstdio/sdk/data";
import type { KanbanRendererQueryParams } from "@pstdio/sdk/extensions";
import { attentionPanelTarget } from "../attention-panel";
import { createTicketRowMapper, statusToColumnConfig } from "./mappers";
import { readStableTicketPage } from "./read-ticket-page";
import { readReviewLinkProjections, reviewLinkProjectionFields } from "./review-link-projections";
import { readReviewCounts } from "./review-query-counts";
import {
  REVIEW_REQUEST_ITEMS_ATTRIBUTE,
  reviewRequestCountSummary,
  reviewSummaryBadgeItems,
} from "./review-request-summary";
import {
  appendLegacyPullRequestBadges,
  loadTicketLinkedResources,
  TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE,
  TICKET_LINKED_RESOURCES_ATTRIBUTE,
} from "./ticket-linked-resources";
import { ticketPageTarget } from "./ticket-page-target";
import { ticketQuerySummary } from "./ticket-query-summary";
import { plannerOwnerFor, readTicketParentLookup } from "./ticket-resource-hierarchy";
import { prepareTicketViewQuery, type TicketQueryContext, type TicketViewSelection } from "./ticket-view-selection";

export const readTicketViewPage = async (
  ctx: TicketQueryContext,
  input: Partial<KanbanRendererQueryParams>,
  selection: TicketViewSelection = {},
  displayFields?: readonly string[],
) => {
  const prepared = await prepareTicketViewQuery(ctx, input, selection);
  const { scope, tags, statuses, attributes } = prepared;
  const requested = (fields: string[]) => !displayFields || fields.some((field) => displayFields.includes(field));
  const showLinkedResources = requested([TICKET_LINKED_RESOURCES_ATTRIBUTE, TICKET_LINKED_RESOURCE_ITEMS_ATTRIBUTE]);
  if (showLinkedResources && scope.fields) scope.fields = [...scope.fields, ...reviewLinkProjectionFields];
  const selected = await readCollectionPage(ctx.storage, scope);
  const tickets = selected.records.flatMap(({ fields }) => {
    const ticket = ticketQuerySummary(fields);
    return ticket ? [ticket] : [];
  });
  const extensionId = selection.owner ?? plannerOwnerFor(ctx);
  const [links, parents, reviews] = await Promise.all([
    showLinkedResources
      ? loadTicketLinkedResources(
          ctx.resources,
          tickets.map(({ id }) => ({ type: "ticket", id, extensionId, projectId: ctx.projectId })),
        )
      : undefined,
    readTicketParentLookup(ctx, new Map(tickets.map((ticket) => [ticket.id, ticket]))),
    readReviewCounts(
      ctx.storage,
      requested(["reviewRequests", REVIEW_REQUEST_ITEMS_ATTRIBUTE]) ? tickets.map(({ id }) => id) : [],
    ),
  ]);
  const projections = new Map(selected.records.map(({ fields }) => [String(fields.id), fields]));
  if (links) {
    for (const { id } of tickets)
      links.set(
        id,
        appendLegacyPullRequestBadges(
          links.get(id) ?? [],
          readReviewLinkProjections(projections.get(id)!),
          ctx.projectId,
        ),
      );
  }
  const toRow = createTicketRowMapper(ctx.projectId, tags, links, parents, extensionId);
  const rows = tickets.map((ticket) => {
    const mapped = toRow(ticket),
      fields = projections.get(ticket.id)!;
    const row = { ...mapped, resource: { ...mapped.resource, extensionId } };
    const review = reviews.get(ticket.id) ?? { total: 0, pending: 0, answered: 0 };
    return {
      ...row,
      target: ticketPageTarget(row.resource),
      attributes: {
        ...row.attributes,
        id: fields.breadcrumb,
        milestone: fields.milestone,
        milestoneDate: fields.milestoneDate,
        milestoneState: fields.milestoneState,
        needsAttention: fields.needsAttention,
        reviewRequests: fields.reviewRequests,
        [REVIEW_REQUEST_ITEMS_ATTRIBUTE]: reviewSummaryBadgeItems(
          reviewRequestCountSummary(review.total, review.pending),
          attentionPanelTarget(row.resource, selection.attentionPage),
        ),
      },
    };
  });
  const result = {
    rows,
    attributes,
    page: selected.page,
    boardColumnConfigs: Object.fromEntries(statuses.map((status) => [status.id, statusToColumnConfig(status)])),
  };
  // An empty selection has no subsequent relationship reads to reconcile with its page revision.
  if (tickets.length)
    await ctx.storage.records.query({
      index: "ticket-view",
      fields: [],
      limit: 0,
      orderBy: [],
      revision: prepared.revision,
    });
  return { ...prepared, result, tickets, projections, reviews, parents };
};

export const queryTicketPage = (
  ctx: TicketQueryContext,
  input: Partial<KanbanRendererQueryParams>,
  signal?: AbortSignal,
) =>
  readStableTicketPage(
    input.page?.cursor !== undefined || input.page?.revision !== undefined,
    async () => (await readTicketViewPage(ctx, input, {}, input.page?.fields)).result,
    signal,
  );
