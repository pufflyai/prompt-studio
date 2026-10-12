// Remove a deleted ticket's agent gate. Planner removes the ticket's review requests itself.
import { defineHook } from "@pstdio/sdk/extensions";
import { findTicket } from "../../data/resolve";
import { plannerTicketsChanged } from "../../events";
import { gates } from "./gate-store";

export const gateCleanup = defineHook({
  id: "timeline.gate-cleanup",
  event: plannerTicketsChanged,
  async run(ctx, { ticketId }) {
    if (!ticketId || (await findTicket(ctx.storage, ticketId))) {
      return;
    }
    await gates(ctx).delete(ticketId);
  },
});
