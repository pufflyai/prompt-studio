import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection, withDerivedTicketState } from "../data/collections";
import { ticketCommandPage } from "../data/ticket-command-page";
import { withTicketTagIds } from "../data/ticket-tags";
export const readTicketsCommand = defineCommand({
  id: "read-tickets",
  title: "Read tickets",
  params: { limit: params.number(), cursor: params.text() },
  async run(ctx, input) {
    const read = async () => {
      const page = await ticketCommandPage(ctx, { ...input, includeDraft: true });
      const selected = await ticketsCollection(ctx).getMany(page.tickets.map(({ id }) => id));
      const tickets = await Promise.all(
        selected.flatMap((ticket) => (ticket ? [withDerivedTicketState(ctx, ticket).then(withTicketTagIds)] : [])),
      );
      await ctx.storage.records.query({
        index: "ticket-view",
        fields: [],
        limit: 1,
        orderBy: [],
        revision: page.revision,
      });
      return { ...page, tickets };
    };
    try {
      return await read();
    } catch (error) {
      // Sync can advance the revision between projection and enrichment.
      if (input.cursor || !(error instanceof Error) || error.message !== "Query revision is stale; restart the query")
        throw error;
      return read();
    }
  },
});
