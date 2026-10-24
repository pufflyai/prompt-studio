// Move a ticket in the execution order, into another deadline, or both.

import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { resolveTicketId } from "../../data/resolve";
import { withWriteGuard } from "../../data/write-guard";
import { moveTicket } from "../model/edit-plan";
import { deadlineOrNone, loadPlan, savePlan } from "./plan-store";
export const moveTicketInPlan = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources">,
  input: { ticket: string; deadline?: string; before?: string },
) => {
  const { ticket: ticketKey, deadline, before } = input;
  return withWriteGuard(ctx, "plan", async () => {
    const { tickets, plan } = await loadPlan(ctx);
    // The plan holds only open tickets, so an archived ticket is unknown here.
    const planTicketId = async (key: string) => {
      const id = await resolveTicketId(ctx, key);
      if (!tickets.some((ticket) => ticket.id === id)) throw new Error(`Unknown ticket "${key}".`);
      return id;
    };
    const ticketId = await planTicketId(ticketKey);
    const current = plan.order.find((entry) => entry.ticketId === ticketId)?.deadlineId ?? null;
    const moved = moveTicket(plan, {
      ticketId,
      deadlineId: deadline === undefined ? current : deadlineOrNone(plan, deadline),
      ...(before ? { beforeId: await planTicketId(before) } : {}),
    });
    await savePlan(ctx, moved, "move");
    return moved.order.find((entry) => entry.ticketId === ticketId);
  });
};

export const moveTicketCommand = defineCommand({
  id: "timeline.plan.move",
  mutating: true,
  title: "Move ticket in plan",
  cli: {
    description: "Move a ticket to a deadline, and optionally before another ticket in that deadline.",
    examples: [
      "pst pstdio-planner timeline plan move --ticket PS-32 --deadline 2026-10-15",
      "pst pstdio-planner timeline plan move --ticket PS-32 --before PS-33",
      "pst pstdio-planner timeline plan move --ticket PS-32 --deadline none",
    ],
  },
  params: {
    ticket: params.text({ label: "Ticket", description: "Ticket shorthand or id, such as PS-32.", required: true }),
    deadline: params.text({
      label: "Deadline",
      description: "Deadline id or date, or none. Omit to keep the current deadline.",
    }),
    before: params.text({ label: "Before", description: "Place the ticket before this ticket. Omit to add it last." }),
  },
  run: moveTicketInPlan,
});
