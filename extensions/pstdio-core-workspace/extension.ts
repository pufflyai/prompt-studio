import { defineExtension, eventRef, params } from "@pstdio/sdk/extensions";

const attemptStatusChanged = eventRef("attemptStatus.changed");

export default defineExtension({
  commands: {
    "set-attempt-status": {
      title: "Set workspace attempt status",
      description: "Transition a workspace to a named attempt status; fires `attemptStatus.changed` on success.",
      params: {
        workspaceId: params.text({ label: "Workspace id" }),
        status: params.text({ label: "Attempt status name" }),
        sessionId: params.text({ label: "Session id", required: false }),
      },
      async run(ctx) {
        const result = await ctx.workspaces.setAttemptStatus({
          workspaceId: ctx.params.workspaceId,
          status: ctx.params.status,
          sessionId: ctx.params.sessionId,
        });

        await ctx.events.emit(attemptStatusChanged, {
          projectId: ctx.projectId,
          workspaceId: result.id,
          fromStatus: result.from_status,
          toStatus: result.to_status,
          ticket: null,
          sessionId: ctx.params.sessionId ?? null,
          originalSessionId: null,
          worktreePath: null,
          workspace: {},
        });

        return result;
      },
    },
  },
});
