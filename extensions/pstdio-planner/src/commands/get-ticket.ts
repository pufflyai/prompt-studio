import { defineCommand, params } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";

export const getTicketCommand = defineCommand({
  title: "Get ticket",
  cli: { globalAliases: [["tickets", "panel"]], examples: ["pstdio tickets panel --id PS-1"] },
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    return (await findTicket(ctx.storage, commandParams.id)) ?? null;
  },
});
