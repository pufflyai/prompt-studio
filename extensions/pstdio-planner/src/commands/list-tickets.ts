import { defineCommand, params } from "@pstdio/sdk/extensions";
import { readStatusDefinitions, readTagDefinitions } from "../data/definition-query";
import { ticketCommandPage } from "../data/ticket-command-page";
import { ticketTagIds } from "../data/ticket-tags";

export const listTicketsCommand = defineCommand({
  id: "list-tickets",
  title: "List tickets",
  cli: {
    examples: ["pstdio pstdio.planner list-tickets --status 'In Progress' --tags High"],
  },
  params: {
    status: params.text(),
    tags: params.list(),
    archived: params.boolean(),
    draft: params.boolean(),
    parent: params.text(),
    limit: params.number(),
    cursor: params.text(),
  },
  async run(ctx, input) {
    const page = await ticketCommandPage(ctx, input);
    const [statuses, tags] = await Promise.all([readStatusDefinitions(ctx.storage), readTagDefinitions(ctx.storage)]);
    const statusNames = new Map(statuses.map(({ id, name }) => [id, name]));
    const optionNames = new Map(tags.flatMap(({ options }) => options).map(({ id, name }) => [id, name]));
    return {
      ...page,
      tickets: page.tickets.map((ticket) => ({
        shorthand: ticket.shorthand,
        title: ticket.title,
        status: statusNames.get(ticket.statusId ?? "") ?? "",
        tags: ticketTagIds(ticket).map((id) => optionNames.get(id) ?? id),
      })),
    };
  },
});
