import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";

// The board sends rowId; the CLI sends --id (a shorthand).
export const deleteTicketCommand = defineCommand({
  title: "Delete ticket",
  cli: { globalAliases: [["tickets", "delete"]], examples: ["pstdio tickets delete --id PS-1"] },
  menus: [
    {
      slot: "ticket.headerOverflow",
      label: l10n("dataRenderers.tickets.rowActions.delete", "Delete"),
      icon: "trash",
      placement: "last",
    },
  ],
  params: { rowId: params.text(), id: params.text() },
  async run(ctx) {
    const ref = ctx.params.id ?? ctx.params.rowId ?? "";
    const id = (await findTicket(ctx.storage, ref))?.id ?? ref;
    await ticketsCollection(ctx.storage).delete(id);
    return { id, deleted: true };
  },
});
