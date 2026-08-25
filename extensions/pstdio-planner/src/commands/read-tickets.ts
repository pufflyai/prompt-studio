import { defineCommand } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { sortedBySortOrder } from "../utils/sort";

export const readTicketsCommand = defineCommand({
  title: "Read tickets",
  async run(ctx, _commandParams) {
    const tickets = await ticketsCollection(ctx.storage).list();
    return sortedBySortOrder(tickets.filter((ticket) => !ticket.archived));
  },
});
