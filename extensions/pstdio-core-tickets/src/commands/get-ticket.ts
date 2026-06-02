import { defineCommand, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";

export const getTicketCommand = defineCommand({
  title: "Get ticket",
  params: { id: params.text({ required: true }) },
  async run(ctx) {
    return (await ticketsCollection(ctx.storage).get(ctx.params.id)) ?? null;
  },
});
