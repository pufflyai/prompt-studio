// Remove a deleted ticket's review requests and outcomes so no orphan request stays pending.
import { defineHook } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";
import { deleteTicketReviewRequests } from "../data/review-request-storage";
import { plannerTicketsChanged } from "../events";

export const reviewRequestCleanupHook = defineHook({
  id: "review-request-cleanup",
  event: plannerTicketsChanged,
  async run(ctx, { ticketId }) {
    if (!ticketId || (await findTicket(ctx.storage, ticketId))) return;
    await deleteTicketReviewRequests(ctx.storage, ticketId);
  },
});
