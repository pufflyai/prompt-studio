import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  schedules: [
    {
      name: "hourly-health-check",
      cron: "0 * * * *",
      timeoutSeconds: 30,
      async trigger(ctx) {
        console.log(
          `[scheduled-demo] hour=${new Date().getUTCHours()} projectId=${ctx.projectId} schedule=${ctx.scheduleName} runId=${ctx.runId}`,
        );
      },
    },
  ],
});
