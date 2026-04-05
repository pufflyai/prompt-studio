import {
  definePlugin,
  setTicketStatus,
  setWorkspaceAttemptStatus,
  updateTicketWhenAllAttemptsMatch,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    // ──────────────────────────────────────────────────────────
    // Runs after a new session starts:
    // update the ticket and attempt status to "wip".
    // ──────────────────────────────────────────────────────────
    async postSessionStart(ctx) {
      // not all sessions are associated with tickets
      if (!ctx.ticket) return;

      // if the ticket is not in review, move it back to wip when a new session starts
      if (ctx.ticket.status_name !== "review") {
        await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
      }

      // initialize the attempt status
      if (ctx.workspace && !ctx.workspace.attempt_status_name) {
        await setWorkspaceAttemptStatus(ctx, {
          workspaceId: ctx.workspace.id,
          statusName: "wip",
          sessionId: ctx.sessionId,
        });
      }
    },

    async postAttemptStatusChange(ctx) {
      if (!ctx.ticket) return;
      // ──────────────────────────────────────────────────────────
      // Mirror blocked attempts onto the ticket so delivery status
      // reflects active blockers as soon as they are reported.
      // ──────────────────────────────────────────────────────────
      if (ctx.toStatus === "blocked") {
        await setTicketStatus(ctx, {
          ticket: ctx.ticket.shorthand,
          status: "blocked",
        });
      }

      // ──────────────────────────────────────────────────────────
      // Advance the ticket to review only when every attempt reaches
      // reviewed to keep multi-attempt work in sync.
      // ──────────────────────────────────────────────────────────
      if (ctx.toStatus === "reviewed") {
        await updateTicketWhenAllAttemptsMatch(ctx, {
          ticketId: ctx.ticket.shorthand,
          allAttemptsStatus: "reviewed",
          setStatus: "review",
        });
      }
    },
  },
});
