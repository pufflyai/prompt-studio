import { readCollectionPage } from "@pstdio/sdk/data";
import type { KanbanRendererQueryParams } from "@pstdio/sdk/extensions";
import { attentionPanelTarget } from "../attention-panel";
import { createTicketRowMapper, statusToColumnConfig } from "./mappers";
import { readReviewCounts } from "./review-query-counts";
import {
  REVIEW_REQUEST_ITEMS_ATTRIBUTE,
  reviewRequestCountSummary,
  reviewSummaryBadgeItems,
} from "./review-request-summary";
import { loadTicketLinkedResources } from "./ticket-linked-resources";
import { ticketPageTarget } from "./ticket-page-target";
import { ticketQuerySummary } from "./ticket-query-summary";
import { readTicketParentLookup } from "./ticket-resource-hierarchy";
import { prepareTicketViewQuery, type TicketQueryContext, type TicketViewSelection } from "./ticket-view-selection";

export const readTicketViewPage = async (
  ctx: TicketQueryContext,
  input: Partial<KanbanRendererQueryParams>,
  selection: TicketViewSelection = {},
) => {
  const prepared = await prepareTicketViewQuery(ctx, input, selection);
  const { scope, tags, statuses, attributes } = prepared;
  const selected = await readCollectionPage(ctx.storage, scope);
  const tickets = selected.records.flatMap(({ fields }) => {
    const ticket = ticketQuerySummary(fields);
    return ticket ? [ticket] : [];
  });
  const extensionId =
    selection.owner ?? (ctx.extensionId === "pstdio.planner" ? ctx.extensionId : "pstdio.pstdio-planner");
  const [links, parents, reviews] = await Promise.all([
    loadTicketLinkedResources(
      ctx.resources,
      tickets.map(({ id }) => ({ type: "ticket", id, extensionId, projectId: ctx.projectId })),
    ),
    readTicketParentLookup(ctx, new Map(tickets.map((ticket) => [ticket.id, ticket]))),
    readReviewCounts(
      ctx.storage,
      tickets.map(({ id }) => id),
    ),
  ]);
  const toRow = createTicketRowMapper(ctx.projectId, tags, links, parents, extensionId);
  const projections = new Map(selected.records.map(({ fields }) => [String(fields.id), fields]));
  const rows = tickets.map((ticket) => {
    const mapped = toRow(ticket),
      fields = projections.get(ticket.id)!;
    const row = { ...mapped, resource: { ...mapped.resource, extensionId } };
    const review = reviews.get(ticket.id)!;
    return {
      ...row,
      target: ticketPageTarget(row.resource),
      attributes: {
        ...row.attributes,
        id: fields.breadcrumb,
        milestone: fields.milestone,
        milestoneDate: fields.milestoneDate,
        milestoneState: ticket.archived ? "unscheduled" : fields.milestoneState,
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
  await ctx.storage.records.query({
    index: "ticket-view",
    fields: [],
    limit: 1,
    orderBy: [],
    revision: prepared.revision,
  });
  return { ...prepared, result, tickets, projections, reviews, parents };
};

export const queryTicketPage = async (ctx: TicketQueryContext, input: Partial<KanbanRendererQueryParams>) =>
  (await readTicketViewPage(ctx, input)).result;
