import { defineCommand, params } from "@pstdio/sdk/extensions";
import { appendLegacyPullRequestBadges } from "../../data/legacy-pull-request-badges";
import { ticketToRow } from "../../data/mappers";
import { ensureTicketStorage } from "../../data/read-migrated-tickets";
import { readReviewLinkProjections, reviewLinkProjectionFields } from "../../data/review-link-projections";
import { loadTicketLinkedResources } from "../../data/ticket-linked-resources";
import { readTicketPageParents } from "../../data/ticket-page-parents";
import { ticketQuerySummary, ticketSummaryFields } from "../../data/ticket-query-summary";
import { plannerOwnerFor } from "../../data/ticket-resource-hierarchy";

// The canvas requests only its visible cards. The full graph remains available for layout and filters.
export const readTicketPreviewsCommand = defineCommand({
  id: "timeline.ticket-previews",
  title: "Read visible ticket previews",
  params: { ticketIds: params.json<string[], { required: true }>({ required: true }) },
  async run(ctx, { ticketIds }) {
    if (!Array.isArray(ticketIds) || ticketIds.length > 100 || ticketIds.some((id) => typeof id !== "string" || !id))
      throw new Error("Select at most 100 ticket identities for card previews.");
    const ids = [...new Set(ticketIds)];
    if (!ids.length) return [];
    await ensureTicketStorage(ctx);
    const page = await ctx.storage.records.query({
      index: "ticket-view",
      fields: [...ticketSummaryFields, ...reviewLinkProjectionFields],
      where: {
        all: [
          { field: "id", op: "in", value: ids },
          { field: "archived", op: "ne", value: true },
        ],
      },
      orderBy: [{ field: "id", direction: "asc" }],
      limit: 100,
    });
    const tickets = page.records.flatMap(({ fields }) => {
      const ticket = ticketQuerySummary(fields);
      return ticket ? [ticket] : [];
    });
    const owner = plannerOwnerFor(ctx);
    const [links, parents] = await Promise.all([
      loadTicketLinkedResources(
        ctx.resources,
        tickets.map(({ id }) => ({
          type: "ticket",
          id,
          projectId: ctx.projectId,
          extensionId: owner,
        })),
        { preview: true },
      ),
      readTicketPageParents(ctx, new Map(tickets.map((ticket) => [ticket.id, ticket]))),
    ]);
    const fields = new Map(page.records.map((record) => [String(record.fields.id), record.fields]));
    for (const ticket of tickets)
      links.set(
        ticket.id,
        appendLegacyPullRequestBadges(
          links.get(ticket.id) ?? [],
          readReviewLinkProjections(fields.get(ticket.id)!),
          ctx.projectId,
          { type: "ticket", id: ticket.id, extensionId: owner, projectId: ctx.projectId },
        ),
      );
    // Providers may have yielded while records changed; reject a mixed-generation result.
    await ctx.storage.records.query({
      index: "ticket-view",
      fields: [],
      limit: 0,
      orderBy: [],
      revision: page.revision,
    });
    return tickets.map((ticket) => ticketToRow(ticket, ctx.projectId, [], links, parents, owner));
  },
});
