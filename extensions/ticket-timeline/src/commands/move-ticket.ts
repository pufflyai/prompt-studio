// Move a ticket in the execution order, into another deadline, or both.

import { defineCommand, params } from "@pstdio/sdk/extensions";
import { moveTicket } from "../model/edit-plan";
import { deadlineOrNone, findTicket, loadPlan, savePlan } from "./plan-store";
import { withWriteGuard } from "./write-guard";

export const moveTicketCommand = defineCommand({
  id: "plan.move",
  title: "Move ticket in plan",
  cli: {
    description: "Move a ticket to a deadline, and optionally before another ticket in that deadline.",
    examples: [
      "pst ticket-timeline plan move --ticket K-32 --deadline 2026-10-15",
      "pst ticket-timeline plan move --ticket K-32 --before K-33",
      "pst ticket-timeline plan move --ticket K-32 --deadline none",
    ],
  },
  params: {
    ticket: params.text({ label: "Ticket", description: "Ticket shorthand or id, such as K-32.", required: true }),
    deadline: params.text({
      label: "Deadline",
      description: "Deadline id or date, or none. Omit to keep the current deadline.",
    }),
    before: params.text({ label: "Before", description: "Place the ticket before this ticket. Omit to add it last." }),
  },
  async run(ctx, { ticket: ticketKey, deadline, before }) {
    return withWriteGuard(ctx, "plan", async () => {
      const { tickets, plan } = await loadPlan(ctx);
      const ticket = findTicket(tickets, ticketKey);
      const current = plan.order.find(({ ticketId }) => ticketId === ticket.id)?.deadlineId ?? null;
      const moved = moveTicket(plan, {
        ticketId: ticket.id,
        deadlineId: deadline === undefined ? current : deadlineOrNone(plan, deadline),
        ...(before ? { beforeId: findTicket(tickets, before).id } : {}),
      });
      await savePlan(ctx, moved, "move");
      return moved.order.find(({ ticketId }) => ticketId === ticket.id);
    });
  },
});
