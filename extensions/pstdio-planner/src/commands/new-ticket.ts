import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketPageTarget } from "../data/ticket-page-target";
import { createTicketCommand } from "./create-ticket";

export const newTicketCommand = defineCommand({
  id: "new-ticket",
  title: "New ticket",
  mutating: true,
  palette: [{}],
  params: { content: params.longText({ label: "Description", required: true }) },
  async run(ctx, input) {
    const ticket = await createTicketCommand.run(ctx, input);
    ctx.navigation.open(ticketPageTarget(ticket.resource));
    return ticket;
  },
});
