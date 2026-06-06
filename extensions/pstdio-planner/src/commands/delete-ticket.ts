import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";

export const deleteTicketCommand = defineCommand({
  title: "Delete ticket",
  params: { rowId: params.text({ required: true }) },
  async run(ctx) {
    await ticketsCollection(ctx.storage).delete(ctx.params.rowId);
    return { id: ctx.params.rowId, deleted: true };
  },
});
