import { defineCommand, params } from "@pstdio/sdk/extensions";
import { moveTicketToInProgress } from "../data/move-to-in-progress";
import { findTicket } from "../data/resolve";

// `pst tickets implement`: move the ticket to in-progress in extension storage and
// launch the implementation agent through the host session capability.
export const implementTicketCommand = defineCommand({
  id: "implement-ticket",
  title: "Implement ticket",
  cli: { globalAliases: [["tickets", "implement"]], examples: ["pstdio tickets implement --id PS-1"] },
  params: {
    id: params.text({ required: true }),
    agent: params.harness({ label: "Model" }),
  },
  async run(ctx, commandParams) {
    const ticket = await findTicket(ctx.storage, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);

    await moveTicketToInProgress(ctx.storage, ticket.id);

    return ctx.sessions.create({
      title: `Implement ticket: ${ticket.shorthand}`,
      ...(commandParams.agent ? { harness: commandParams.agent } : {}),
      template: "implement-ticket",
      vars: { ticket: ticket.id },
    });
  },
});
