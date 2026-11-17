import { defineCommand, l10n, params, type ResourceRef } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";
export const ticketActivityContextCommand = defineCommand({
  id: "ticket-activity-context",
  title: l10n("activity.context", "Read ticket context"),
  params: { resource: params.json<ResourceRef>() },
  async run(ctx, input) {
    const ticket = await findTicket(ctx, input.resource?.id ?? ctx.resource?.id ?? "");
    if (!ticket) throw new Error("Ticket not found.");
    return { text: ticket.content };
  },
});
