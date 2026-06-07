import { defineCommand, params } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";

export const getTicketCommand = defineCommand({
  title: "Get ticket",
  cli: { globalAliases: [["tickets", "view"]], examples: ["pstdio tickets view --id T-1"] },
  params: { id: params.text({ required: true }) },
  async run(ctx) {
    return (await findTicket(ctx.storage, ctx.params.id)) ?? null;
  },
});
