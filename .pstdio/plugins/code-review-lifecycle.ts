import {
  createSession,
  definePlugin,
  followupSession,
  runCommand,
  setWorkspaceAttemptStatus,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    // ──────────────────────────────────────────────────────────
    // Blocks the transition to review-ready when validation fails
    // in the workspace and returns command output as the
    // rejection reason for immediate feedback.
    // ──────────────────────────────────────────────────────────
    async preAttemptStatusChange(ctx) {
      if (ctx.toStatus !== "review-ready") return;
      if (!ctx.worktreePath) return;

      // ────────────────────────────────────────────────────────
      // >>> Replace with your validation command <<<
      const validationCMD = ["bun", "run", "validate"];
      // ────────────────────────────────────────────────────────

      const validation = await runCommand(ctx.worktreePath, validationCMD);

      if (validation.exitCode !== 0) {
        const output = [validation.stdout, validation.stderr].join("\n").trim();
        return {
          reject: true,
          reason: output
            ? `Validation failed; cannot move to review-ready\n\n${output}`
            : "Validation failed; cannot move to review-ready",
        };
      }
    },

    async postAttemptStatusChange(ctx) {
      if (!ctx.ticket) return;

      // ────────────────────────────────────────────────────────
      // Start a review session when attempt moves to review-ready
      // ────────────────────────────────────────────────────────
      if (ctx.toStatus === "review-ready") {
        await createSession(ctx, {
          workspace_id: ctx.workspace.id,
          title: `Code review: ${ctx.ticket.shorthand}`,
          template: "code-review",
          vars: { ticket: ctx.ticket.shorthand },
          original_session_id: ctx.sessionId,
        });
      }

      // ────────────────────────────────────────────────────────
      // Return the attempt to wip and follow-up the original
      // session so review feedback is addressed.
      // ────────────────────────────────────────────────────────
      if (ctx.toStatus === "changes-requested") {
        await setWorkspaceAttemptStatus(ctx, {
          workspaceId: ctx.workspace.id,
          sessionId: ctx.sessionId,
          statusName: "wip",
        });

        await followupSession(ctx, {
          sessionId: ctx.originalSessionId,
          template: "fix-changes-requested",
          vars: { ticket: ctx.ticket.shorthand },
        });
      }
    },
  },
});
