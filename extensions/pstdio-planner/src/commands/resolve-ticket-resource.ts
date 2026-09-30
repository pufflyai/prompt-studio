import { defineCommand } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { createTicketParentLookup, TICKET_RESOURCE_ICON } from "../data/mappers";
import { findTicket } from "../data/resolve";
import { ticketResourceReference } from "../data/ticket-resource-hierarchy";

// The host runs this for an open ticket page so its title and menus follow the ticket.
// Page state such as the selected document stays in the incoming metadata.
export const resolveTicketResourceCommand = defineCommand({
  id: "resolve-ticket-resource",
  title: "Resolve ticket resource",
  async run(ctx) {
    const ticket = ctx.resource?.type === "ticket" ? await findTicket(ctx.storage, ctx.resource.id) : undefined;
    if (!ticket) return null;
    const current = ticketResourceReference(
      ticket,
      createTicketParentLookup(await ticketsCollection(ctx.storage).list()),
    );
    return { ...current, icon: TICKET_RESOURCE_ICON, metadata: { ...ctx.resource?.metadata, ...current.metadata } };
  },
});
