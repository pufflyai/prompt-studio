import { defineHook, resourceEvents } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { moveTicketCheckout } from "../data/ticket-checkout";
import { plannerTicketsChanged } from "../events";

export const ticketRenumberedHook = defineHook({
  id: "ticket-renumbered",
  event: resourceEvents.renumbered,
  async run(ctx, event) {
    if (event.resource.type !== "ticket" || event.resource.extensionId !== ctx.extensionId) return;
    const ticket = await ticketsCollection(ctx).get(event.resource.id);
    if (!ticket) return;
    try {
      if (ctx.projectFiles) await moveTicketCheckout(ctx.projectFiles, ticket, event.previousShorthand);
    } finally {
      await ctx.events.emit(plannerTicketsChanged, { ticketId: ticket.id });
    }
  },
});
