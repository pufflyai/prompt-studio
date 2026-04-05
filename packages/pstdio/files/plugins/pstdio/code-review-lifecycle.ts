import {
  createSession,
  definePlugin,
  followupSession,
  runCommand,
  setWorkspaceAttemptStatus,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preAttemptStatusChange(ctx) {
      if (ctx.toStatus !== "review-ready") return;
      if (!ctx.worktreePath) return;

      const validation = await runCommand(ctx.worktreePath, ["bun", "run", "validate"]);
      if (validation.exitCode === 0) return;

      const output = [validation.stdout, validation.stderr].join("\n").trim();
      return {
        reject: true,
        reason: output
          ? `Validation failed; cannot move to review-ready\n\n${output}`
          : "Validation failed; cannot move to review-ready",
      };
    },

    async postAttemptStatusChange(ctx) {
      if (!ctx.ticket) return;

      if (ctx.toStatus === "review-ready") {
        await createSession(ctx, {
          workspace_id: ctx.workspace.id,
          title: `Code review: ${ctx.ticket.shorthand}`,
          template: "code-review",
          vars: { ticket: ctx.ticket.shorthand },
          original_session_id: ctx.sessionId,
        });
      }

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
