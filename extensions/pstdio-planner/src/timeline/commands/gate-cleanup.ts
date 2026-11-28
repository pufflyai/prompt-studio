// Remove a deleted ticket's agent gate. Planner removes the ticket's review requests itself.
import { defineHook } from "@pstdio/sdk/extensions";
import { ticketRecordId } from "../../data/ticket-records";
import { plannerTicketsChanged } from "../../events";
import { gates } from "./gate-store";

export const gateCleanup = defineHook({
  id: "timeline.gate-cleanup",
  event: plannerTicketsChanged,
  async run(ctx, { ticketId, deleted }) {
    if (!deleted || !ticketId || !(await ctx.storage.records.read(ticketRecordId(ctx.storage, ticketId))).deleted) {
      return;
    }
    await gates(ctx).delete(ticketId);
  },
});
