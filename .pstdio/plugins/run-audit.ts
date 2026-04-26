import { createSession, definePlugin } from "@pstdio/sdk/plugins";

const dailyAuditPrompt =
  "Audit the repository for bugs, architecture violations, and low-effort/high-value refactors. For each actionable issue, create a ticket with details, and acceptance criteria. Avoid duplicate tickets, speculative findings, and subjective style-only feedback.";

export default definePlugin({
  schedules: [
    {
      name: "daily-repository-audit",
      cron: "8 10 * * *",
      timeoutMs: 120_000,
      async handler(ctx) {
        await createSession(ctx, {
          title: "Daily repository audit",
          prompt: dailyAuditPrompt,
        });
      },
    },
  ],
});
