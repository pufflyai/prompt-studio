import { defineCommand } from "@pstdio/sdk/extensions";
import { readTicketsWithReviewState } from "../data/collections";
import { readMigratedTickets } from "../data/read-migrated-tickets";
import type { TicketContext } from "../data/ticket-identity";
import { withTicketTagIds } from "../data/ticket-tags";
import type { Ticket } from "../data/types";
import { sortedByTicketOrder } from "../utils/sort";
export const readTickets = async (ctx: TicketContext, snapshot?: Ticket[]) =>
  sortedByTicketOrder((await readTicketsWithReviewState(ctx, snapshot)).filter((ticket) => !ticket.archived));

export const readTicketsCommand = defineCommand({
  id: "read-tickets",
  title: "Read tickets",
  async run(ctx, _commandParams) {
    const migrated = await readMigratedTickets(ctx);
    return (await readTickets(ctx, migrated)).map(withTicketTagIds);
  },
});
