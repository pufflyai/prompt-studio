import type { CommandContext } from "@pstdio/sdk/extensions";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";
import { withWriteGuard } from "../../data/write-guard";
import { planChanged } from "../contracts";
import type { PlannerTicket } from "../planner";
import { initializePlanPlacements } from "./initialize-placements";
import { movePlanPlacement, readPlanMetadata } from "./placement-store";
import { deadlineOrNone } from "./plan-store";

// Validate placement before creation and preserve the ticket identity if the plan write fails.
export async function placeNewTicket<T extends PlannerTicket>(
  ctx: CommandContext,
  milestone: string,
  create: () => Promise<T>,
) {
  let created: T | undefined;
  try {
    return await withWriteGuard(ctx, "plan", async () => {
      const plan = await readPlanMetadata(ctx.storage);
      const deadlineId = deadlineOrNone(plan, milestone);
      const workflow = usableWorkflowStatuses(await readWorkflowStatuses(ctx));
      await initializePlanPlacements(ctx.storage, workflow.completedStatusIds);
      const ticket = await create();
      created = ticket;
      try {
        await movePlanPlacement(ctx.storage, { ticketId: ticket.id, deadlineId });
        await ctx.events.emit(planChanged, { reason: "ticket" });
        return { ticket, placementError: null as string | null };
      } catch (error) {
        return { ticket, placementError: String(error) };
      }
    });
  } catch (error) {
    if (!created) throw error;
    return { ticket: created, placementError: String(error) };
  }
}
