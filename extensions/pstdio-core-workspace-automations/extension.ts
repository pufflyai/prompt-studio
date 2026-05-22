import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    runReview: {
      title: "Run review",
      description: "Start a code review session for a workspace.",
      cli: true,
      params: {
        workspaceId: params.text({ label: "Workspace", required: true }),
        ticket: params.text({ label: "Ticket", required: false }),
        harness: params.harness({ label: "Harness", required: false }),
      },
      async run(ctx) {
        const { harness, workspaceId } = ctx.params;
        const ticket = ctx.params.ticket?.trim();
        await ctx.sessions.create({
          workspaceId,
          title: `Code review: ${ticket || "ticket"}`,
          harness,
          template: "review-code",
          vars: ticket ? { ticket } : {},
        });
      },
    },
  },
});
