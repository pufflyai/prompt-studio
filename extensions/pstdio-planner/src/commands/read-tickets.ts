import { defineCommand } from "@pstdio/sdk/extensions";
import { readTicketsWithReviewState } from "../data/collections";
import type { TicketContext } from "../data/ticket-identity";
import { withTicketTagIds } from "../data/ticket-tags";
import { sortedBySortOrder } from "../utils/sort";
export const readTickets = async (ctx: TicketContext) =>
  sortedBySortOrder((await readTicketsWithReviewState(ctx)).filter((ticket) => !ticket.archived));

export const readTicketsCommand = defineCommand({
  id: "read-tickets",
  title: "Read tickets",
  async run(ctx, _commandParams) {
    return (await readTickets(ctx)).map(withTicketTagIds);
  },
});
