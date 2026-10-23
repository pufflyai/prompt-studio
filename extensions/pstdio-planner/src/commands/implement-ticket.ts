import { defineCommand, params } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";
import { renderOwnedTemplate } from "../data/template-store";

// Launch the responsible agent. It updates progress using current project statuses.
export const implementTicketCommand = defineCommand({
  id: "implement-ticket",
  mutating: true,
  title: "Implement ticket",
  cli: { globalAliases: [["tickets", "implement"]], examples: ["pstdio tickets implement --id PS-1"] },
  params: {
    id: params.text({ required: true }),
    agent: params.harness({ label: "Model" }),
  },
  async run(ctx, commandParams) {
    const ticket = await findTicket(ctx.storage, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);

    return ctx.sessions.create({
      title: `Implement ticket: ${ticket.shorthand}`,
      ...(commandParams.agent ? { harness: commandParams.agent } : {}),
      prompt: await renderOwnedTemplate(ctx, "implement-ticket", { ticket: ticket.id }),
    });
  },
});
