// Remove action and agent gate data only when its owning Planner ticket has been deleted.
import { defineHook } from "@pstdio/sdk/extensions";
import { callPlanner, planner, plannerTicketsChanged } from "../planner";
import { requests, responses } from "./action-store";
import { artifactNodes } from "./artifact-store";
import { gates } from "./gate-store";

export const actionCleanup = defineHook({
  id: "action-cleanup",
  event: plannerTicketsChanged,
  async run(ctx, { ticketId }) {
    if (!ticketId) {
      return;
    }
    const ticket = await callPlanner(ctx, planner.getTicket, { id: ticketId });
    if (ticket) {
      return;
    }
    for (const action of (await requests(ctx).list()).filter((entry) => entry.ticketId === ticketId)) {
      await requests(ctx).delete(action.id);
      await responses(ctx).delete(action.id);
    }
    await gates(ctx).delete(ticketId);
    await artifactNodes(ctx).delete(ticketId);
  },
});
