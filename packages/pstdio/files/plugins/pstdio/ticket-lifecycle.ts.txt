import {
  definePlugin,
  setTicketStatus,
  setWorkspaceAttemptStatus,
  updateTicketWhenAllAttemptsMatch,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;

      if (ctx.ticket.status_name !== "review") {
        await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
      }

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

      if (ctx.toStatus === "blocked") {
        await setTicketStatus(ctx, {
          ticket: ctx.ticket.shorthand,
          status: "blocked",
        });
      }

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
