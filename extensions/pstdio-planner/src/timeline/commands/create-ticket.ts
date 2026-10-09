import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { createTicketCommand as createPlannerTicket } from "../../commands/create-ticket";
import type { StoredTicketAttachment } from "../../data/types";
import { moveTicket } from "../model/edit-plan";
import { resolvePlan } from "../model/resolve-plan";
import { findDeadlineId, loadPlan, savePlan } from "./plan-store";
import { withWriteGuard } from "./write-guard";
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
  let created: Awaited<ReturnType<typeof createPlannerTicket.run>> | undefined;
  try {
    return await withWriteGuard(ctx, "plan", async () => {
      const loaded = await loadPlan(ctx);
      const deadlineId =
        input.deadline && input.deadline !== "none" ? findDeadlineId(loaded.plan, input.deadline) : null;
      const { deadline: _deadline, ...ticketInput } = input;
      const ticket = await createPlannerTicket.run(ctx, ticketInput);
      created = ticket;
      try {
        const next = resolvePlan(loaded.plan, [...loaded.tickets, ticket]);
        await savePlan(ctx, moveTicket(next, { ticketId: ticket.id, deadlineId }), "ticket");
        return { ticket, placementError: null as string | null };
      } catch (reason) {
        return { ticket, placementError: String(reason) };
      }
    });
  } catch (reason) {
    if (!created) throw reason;
    return { ticket: created, placementError: String(reason) };
  }
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
