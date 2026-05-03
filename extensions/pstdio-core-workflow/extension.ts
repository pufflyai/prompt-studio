import { defineExtension, eventRef, sessionEvents } from "@pstdio/sdk/extensions";

// Placeholder event ref — the kernel does not yet emit attempt-status changes.
const attemptStatusChanged = eventRef<{
  ticketId?: string;
  workspaceId?: string;
  fromStatus?: string;
  toStatus: string;
  worktreePath?: string;
  sessionId?: string;
  originalSessionId?: string;
}>("pstdio.attempts.statusChanged");

export default defineExtension({
  id: "pstdio.core-workflow",
  namespace: "core-workflow",
  name: "Core Workflow",
  version: "0.1.0",
  description:
    "Ticket and code-review lifecycle automation migrated from the legacy ticket-lifecycle and code-review-lifecycle plugins.",

  hooks: {
    // ────────────────────────────────────────────────────────────
    // From ticket-lifecycle.ts: postSessionStart
    // Has a kernel equivalent — sessionEvents.started.
    // ────────────────────────────────────────────────────────────
    onSessionStarted: {
      event: sessionEvents.started,
      async handler(_ctx, _event) {
        // TODO(helper): re-enable status syncing once `setTicketStatus` and
        // `setWorkspaceAttemptStatus` are exposed on the extension `ctx`,
        // and the session-started payload carries ticket + workspace anchors
        // with `status_name` + `attempt_status_name`.
        // Original plugin body:
        //   if (!ctx.ticket) return;
        //   if (ctx.ticket.status_name !== "review") {
        //     await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
        //   }
        //   if (ctx.workspace && !ctx.workspace.attempt_status_name) {
        //     await setWorkspaceAttemptStatus(ctx, {
        //       workspaceId: ctx.workspace.id,
        //       statusName: "wip",
        //       sessionId: ctx.sessionId,
        //     });
        //   }
      },
    },

    // ────────────────────────────────────────────────────────────
    // From ticket-lifecycle.ts: postAttemptStatusChange
    // No kernel event yet → using a placeholder ref.
    // ────────────────────────────────────────────────────────────
    onAttemptStatusChangedTicketSync: {
      event: attemptStatusChanged,
      async handler(_ctx, _event) {
        // TODO(event): replace `attemptStatusChanged` with the canonical kernel
        // event once defined.
        // TODO(helper): wire `setTicketStatus` and `updateTicketWhenAllAttemptsMatch`
        // when those are exposed on `ctx`.
        // Original plugin body:
        //   if (!ctx.ticket) return;
        //   if (ctx.toStatus === "blocked") {
        //     await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "blocked" });
        //   }
        //   if (ctx.toStatus === "reviewed") {
        //     await updateTicketWhenAllAttemptsMatch(ctx, {
        //       ticketId: ctx.ticket.shorthand,
        //       allAttemptsStatus: "reviewed",
        //       setStatus: "review",
        //     });
        //   }
      },
    },

    // ────────────────────────────────────────────────────────────
    // From code-review-lifecycle.ts: postAttemptStatusChange
    // Same event as above; kept as a separate hook to preserve the
    // legacy file boundary.
    // ────────────────────────────────────────────────────────────
    onAttemptStatusChangedReview: {
      event: attemptStatusChanged,
      async handler(_ctx, _event) {
        // TODO(helper): wire `saveTicket` + review-session creation once those
        // helpers (and the ticket payload on the event) are available.
        // Original plugin body:
        //   if (!ctx.ticket) return;
        //   if (ctx.toStatus === "review-ready") {
        //     if (ctx.worktreePath) {
        //       await saveTicket(ctx, { rootPath: ctx.worktreePath, ticketId: ctx.ticket.shorthand });
        //     }
        //     await createSession(ctx, {
        //       workspace_id: ctx.workspace.id,
        //       title: `Code review: ${ctx.ticket.shorthand}`,
        //       template: "review-code",
        //       vars: { ticket: ctx.ticket.shorthand },
        //       original_session_id: ctx.sessionId,
        //     });
        //   }
        //   if (ctx.toStatus === "changes-requested") {
        //     if (!ctx.originalSessionId) {
        //       await createSession(ctx, {
        //         workspace_id: ctx.workspace.id,
        //         title: `Fix changes requested: ${ctx.ticket.shorthand}`,
        //         template: "fix-changes-requested",
        //         vars: { ticket: ctx.ticket.shorthand },
        //         original_session_id: ctx.sessionId,
        //       });
        //       return;
        //     }
        //     await followupSession(ctx, {
        //       sessionId: ctx.originalSessionId,
        //       template: "fix-changes-requested",
        //       vars: { ticket: ctx.ticket.shorthand },
        //     });
        //   }
      },
    },
  },

  middlewares: {
    // ────────────────────────────────────────────────────────────
    // From code-review-lifecycle.ts: preAttemptStatusChange
    // Pre-hooks become middlewares attached to the command that performs
    // the status transition. No such command is registered today, so the
    // middleware target is a placeholder.
    // ────────────────────────────────────────────────────────────
    validateBeforeReviewReady: {
      command: "pstdio.attempts.set-status", // TODO(command): point at the canonical attempt-status-change command once one is registered.
      async handler(_ctx) {
        // TODO(middleware): re-enable once a real attempt-status-change command
        // exists and `ctx.params` carries `toStatus` + `worktreePath`.
        // Original plugin body:
        //   if (ctx.toStatus !== "review-ready") return;
        //   if (!ctx.worktreePath) return;
        //   const validationCMD = ["echo", "Replace with your validation command"];
        //   const validation = await runCommand(ctx.worktreePath, validationCMD);
        //   if (validation.exitCode !== 0) {
        //     const output = [validation.stdout, validation.stderr].join("\n").trim();
        //     return { reject: true, reason: output ? `Validation failed; cannot move to review-ready\n\n${output}` : "Validation failed; cannot move to review-ready" };
        //   }
      },
    },
  },
});
