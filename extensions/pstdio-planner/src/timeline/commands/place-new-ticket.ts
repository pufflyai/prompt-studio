import type { CommandContext } from "@pstdio/sdk/extensions";
import { moveTicket } from "../model/edit-plan";
import { resolvePlan } from "../model/resolve-plan";
import type { PlannerTicket } from "../planner";
import { deadlineOrNone, loadPlan, savePlan } from "./plan-store";
import { withWriteGuard } from "./write-guard";

// Validate placement before creation and preserve the ticket identity if the plan write fails.
export async function placeNewTicket<T extends PlannerTicket>(
  ctx: CommandContext,
  milestone: string,
  create: () => Promise<T>,
) {
  let created: T | undefined;
  try {
    return await withWriteGuard(ctx, "plan", async () => {
      const loaded = await loadPlan(ctx);
      const deadlineId = deadlineOrNone(loaded.plan, milestone);
      const ticket = await create();
      created = ticket;
      try {
        const plan = resolvePlan(loaded.plan, [...loaded.tickets, ticket], loaded.statuses);
        await savePlan(ctx, moveTicket(plan, { ticketId: ticket.id, deadlineId }), "ticket");
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
