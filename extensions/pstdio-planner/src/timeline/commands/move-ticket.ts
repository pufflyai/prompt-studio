// Move a ticket in the execution order, into another deadline, or both.

import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import { findStoredTicket } from "../../data/resolve";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";
import { withWriteGuard } from "../../data/write-guard";
import { planChanged } from "../contracts";
import { initializePlanPlacements } from "./initialize-placements";
import { movePlanPlacement, planPlacements, readPlanMetadata } from "./placement-store";
import { deadlineOrNone } from "./plan-store";
export const moveTicketInPlan = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources">,
  input: { ticket: string; deadline?: string; before?: string },
) => {
  const { ticket: ticketKey, deadline, before } = input;
  return withWriteGuard(ctx, "plan", async () => {
    const plan = await readPlanMetadata(ctx.storage);
    // The plan holds only open tickets, so an archived ticket is unknown here.
    const planTicketId = async (key: string) => {
      const ticket = await findStoredTicket(ctx, key);
      if (!ticket || ticket.archived) throw new Error(`Unknown ticket "${key}".`);
      return ticket.id;
    };
    const ticketId = await planTicketId(ticketKey);
    const workflow = usableWorkflowStatuses(await readWorkflowStatuses(ctx));
    await initializePlanPlacements(ctx.storage, workflow.completedStatusIds);
    const current = (await planPlacements(ctx.storage).get(ticketId))?.deadlineId ?? null;
    const moved = await movePlanPlacement(ctx.storage, {
      ticketId,
      deadlineId: deadline === undefined ? current : deadlineOrNone(plan, deadline),
      ...(before ? { beforeId: await planTicketId(before) } : {}),
    });
    await ctx.events.emit(planChanged, { reason: "move" });
    return moved ? { ticketId: moved.ticketId, deadlineId: moved.deadlineId } : undefined;
  });
};

export const moveTicketCommand = defineCommand({
  id: "timeline.plan.move",
  mutating: true,
  title: "Move ticket in plan",
  cli: {
    description: "Move a ticket to a deadline, and optionally before another ticket in that deadline.",
    examples: [
      "pst pstdio.planner timeline plan move --ticket PS-32 --deadline 2026-10-15",
      "pst pstdio.planner timeline plan move --ticket PS-32 --before PS-33",
      "pst pstdio.planner timeline plan move --ticket PS-32 --deadline none",
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
