import { defineCommand } from "@pstdio/sdk/extensions";

export const heartbeatCommand = defineCommand({
  id: "heartbeat",
  title: "Lab heartbeat",
  description: "Log emitted by the heartbeat schedule.",
  async run(ctx, _commandParams) {
    const scheduledFor = String(ctx.invocation.metadata?.scheduledFor ?? new Date().toISOString());
    const runId = String(ctx.invocation.metadata?.runId ?? ctx.invocationId);
    const metadata = {
      projectId: ctx.projectId,
      runId,
      scheduledFor,
      ...(ctx.source ? { source: ctx.source } : {}),
    };

    console.info(`[extension-lab] heartbeat project=${ctx.projectId} scheduledFor=${scheduledFor} runId=${runId}`);
    ctx.logger.info("Lab heartbeat", metadata);

    return {
      heartbeat: true,
      runId,
      scheduledFor,
    };
  },
});
