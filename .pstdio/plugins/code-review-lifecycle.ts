import {
  createSession,
  definePlugin,
  followupSession,
  runCommand,
  // setWorkspaceAttemptStatus,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    // disabled due to validation pipeline issues
    // ──────────────────────────────────────────────────────────
    // Blocks the transition to review-ready when validation fails
    // in the workspace and returns command output as the
    // rejection reason for immediate feedback.
    // ──────────────────────────────────────────────────────────
    // async preAttemptStatusChange(ctx) {
    //   if (ctx.toStatus !== "review-ready") return;
    //   if (!ctx.worktreePath) return;
    //
    //   // ────────────────────────────────────────────────────────
    //   // >>> Replace with your validation command <<<
    //   const validationCMD = ["bun", "run", "validate"];
    //   // ────────────────────────────────────────────────────────
    //
    //   const validation = await runCommand(ctx.worktreePath, validationCMD);
    //
    //   if (validation.exitCode !== 0) {
    //     const output = [validation.stdout, validation.stderr].join("\n").trim();
    //     return {
    //       reject: true,
    //       reason: output
    //         ? `Validation failed; cannot move to review-ready\n\n${output}`
    //         : "Validation failed; cannot move to review-ready",
    //     };
    //   }
    // },

    async postAttemptStatusChange(ctx) {
      if (!ctx.ticket) return;

      // ────────────────────────────────────────────────────────
      // Persist ticket edits and artifacts from the worktree, then
      // start a review session when attempt moves to review-ready.
      // ────────────────────────────────────────────────────────
      if (ctx.toStatus === "review-ready") {
        if (ctx.worktreePath) {
          // TODO: CHANGE WITH THE SAVE TICKET SDK COMMAND ONCE AVAILABLE
          await runCommand(ctx.worktreePath, ["pstdio", "tickets", "save", "--id", ctx.ticket.shorthand]);
        }

        await createSession(ctx, {
          workspace_id: ctx.workspace.id,
          title: `Code review: ${ctx.ticket.shorthand}`,
          template: "review-code",
          vars: { ticket: ctx.ticket.shorthand },
          original_session_id: ctx.sessionId,
        });
      }

      // ────────────────────────────────────────────────────────
      // Return the attempt to wip and follow-up the original
      // session so review feedback is addressed.
      // ────────────────────────────────────────────────────────
      if (ctx.toStatus === "changes-requested") {
        if (!ctx.originalSessionId) {
          await createSession(ctx, {
            workspace_id: ctx.workspace.id,
            title: `Fix changes requested: ${ctx.ticket.shorthand}`,
            template: "fix-changes-requested",
            vars: { ticket: ctx.ticket.shorthand },
            original_session_id: ctx.sessionId,
          });
          return;
        }

        await followupSession(ctx, {
          sessionId: ctx.originalSessionId,
          template: "fix-changes-requested",
          vars: { ticket: ctx.ticket.shorthand },
        });
      }
    },
  },
});
