import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { createTicketCommand as createPlannerTicket } from "../../commands/create-ticket";
import type { StoredTicketAttachment } from "../../data/types";
import { placeNewTicket } from "./place-new-ticket";
export const timelineTicketParams = {
  content: params.longText({ required: true }),
  attributes: params.json<Record<string, unknown>>(),
  attachments: params.json<StoredTicketAttachment[]>(),
  deadline: params.text(),
  dependsOn: params.list(),
};
type TicketInput = Parameters<typeof createPlannerTicket.run>[1] & { deadline?: string };
// A saved ticket keeps its identity when a later placement write needs a retry.
export async function createPlacedTicket(ctx: CommandContext, input: TicketInput) {
  const { deadline, ...ticketInput } = input;
  return placeNewTicket(ctx, deadline ?? "none", async () => createPlannerTicket.run(ctx, ticketInput));
}
export const createTicketCommand = defineCommand({
  id: "timeline.ticket.create",
  title: "Create timeline ticket",
  cli: { description: "Create a Planner ticket from its markdown body and place it in a milestone." },
  mutating: true,
  params: timelineTicketParams,
  async run(ctx, input) {
    if (!input.content.trim()) throw new Error("A ticket body is required.");
    return createPlacedTicket(ctx, input);
  },
});
