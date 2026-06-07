import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket } from "../data/resolve";

// The board sends rowId; the CLI sends --id (a shorthand).
export const deleteTicketCommand = defineCommand({
  title: "Delete ticket",
  cli: { globalAliases: [["tickets", "delete"]], examples: ["pstdio tickets delete --id T-1"] },
  params: { rowId: params.text(), id: params.text() },
  async run(ctx) {
    const ref = ctx.params.id ?? ctx.params.rowId ?? "";
    const id = (await findTicket(ctx.storage, ref))?.id ?? ref;
    await ticketsCollection(ctx.storage).delete(id);
    return { id, deleted: true };
  },
});
