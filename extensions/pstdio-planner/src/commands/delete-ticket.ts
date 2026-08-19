import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";
import { plannerTicketsChanged } from "../events";
import { ticketRefFromCommandContext } from "./ticket-command-ref";

export const deleteTicketCommand = defineCommand({
  title: "Delete ticket",
  cli: { globalAliases: [["tickets", "delete"]], examples: ["pstdio tickets delete --id PS-1"] },
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("kanbanRenderers.tickets.rowActions.delete", "Delete"),
      icon: "trash",
      placement: "last",
    },
  ],
  async run(ctx) {
    const ref = ticketRefFromCommandContext(ctx);
    const id = (await findTicket(ctx.storage, ref))?.id ?? ref;
    await ticketsCollection(ctx.storage).delete(id);
    await ctx.events.emit(plannerTicketsChanged, { ticketId: id });
    return { id, deleted: true };
  },
});
