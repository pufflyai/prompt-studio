// Remove a deleted ticket's review requests and outcomes so no orphan request stays pending.
import { defineHook } from "@pstdio/sdk/extensions";
import { deleteTicketReviewRequests } from "../data/review-request-storage";
import { ticketRecordId } from "../data/ticket-records";
import { plannerTicketsChanged } from "../events";

export const reviewRequestCleanupHook = defineHook({
  id: "review-request-cleanup",
  event: plannerTicketsChanged,
  async run(ctx, { ticketId, deleted }) {
    if (!deleted || !ticketId || !(await ctx.storage.records.read(ticketRecordId(ctx.storage, ticketId))).deleted)
      return;
    await deleteTicketReviewRequests(ctx.storage, ticketId);
  },
});
