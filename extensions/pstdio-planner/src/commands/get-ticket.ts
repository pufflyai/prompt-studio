import { defineCommand, params } from "@pstdio/sdk/extensions";
import { findTickets } from "../data/resolve";

export const getTicketCommand = defineCommand({
  id: "get-ticket",
  title: "Get ticket",
  cli: { globalAliases: [["tickets", "panel"]], examples: ["pstdio tickets panel --id PS-1"] },
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    const matches = await findTickets(ctx, commandParams.id);
    return matches.length > 1 ? matches : (matches[0] ?? null);
  },
});
