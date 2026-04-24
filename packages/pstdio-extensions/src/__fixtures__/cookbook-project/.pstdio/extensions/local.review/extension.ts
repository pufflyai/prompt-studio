import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "local.review",
  name: "Review",
  commands: {
    runReview: {
      title: "Run review",
      target: "workspace",
      params: {
        harness: params.harness({ label: "Harness" }),
      },
      menus: [{ slot: "workspace.header.primary", order: 10 }],
      cli: {
        path: "workspaces review",
        description: "Start a review session for a workspace",
        examples: ["pstdio workspaces review --workspace <id>"],
      },
      async run(ctx) {
        await ctx.sessions.create({
          title: "Review workspace",
          prompt: "Review this workspace.",
          anchors: [{ type: "workspace", id: ctx.target.id, role: "primary" }],
        });
      },
    },
  },
});
