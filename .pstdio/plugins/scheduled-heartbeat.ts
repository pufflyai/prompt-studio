import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  schedules: [
    {
      name: "minute-heartbeat",
      cron: "* * * * *",
      timeoutMs: 15_000,
      handler(ctx) {
        console.info(
          `[plugin:schedule] ${ctx.scheduleName} project=${ctx.projectId} scheduledFor=${ctx.scheduledFor} runId=${ctx.runId}`,
        );
      },
    },
  ],
});
