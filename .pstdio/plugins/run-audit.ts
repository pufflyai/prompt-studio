import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  schedules: [
    // {
    //   name: "daily-repository-audit",
    //   cron: "8 10 * * *",
    //   timeoutMs: 120_000,
    //   async handler(ctx) {
    //     await createSession(ctx, {
    //       title: "Daily repository audit",
    //       prompt: dailyAuditPrompt,
    //     });
    //   },
    // },
  ],
});
