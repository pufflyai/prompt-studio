import { defineExtension, params } from "@pstdio/sdk/extensions";

const stringMetadata = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const workspaceIdFrom = (ctx: {
  params: { workspaceId?: string };
  resource?: { type: string; id: string; metadata?: Record<string, unknown> };
}) => {
  const workspaceId = ctx.params.workspaceId?.trim();
  if (workspaceId) return workspaceId;
  if (ctx.resource?.type !== "workspace") throw new Error("Workspace is required.");
  return stringMetadata(ctx.resource.metadata, "workspaceId") ?? ctx.resource.id;
};

const ticketRefFrom = (ctx: {
  params: { ticket?: string };
  resource?: { type: string; label?: string; metadata?: Record<string, unknown> };
}) => {
  return ctx.params.ticket?.trim() ?? stringMetadata(ctx.resource?.metadata, "ticket") ?? ctx.resource?.label?.trim();
};

export default defineExtension({
  commands: {
    runReview: {
      title: "Run review",
      description: "Start a code review session for a workspace.",
      cli: true,
      menus: [{ target: "workbench.nav.actions", label: "Run review", when: { resourceType: ["workspace"] } }],
      params: {
        workspaceId: params.text({ label: "Workspace", required: true }),
        ticket: params.text({ label: "Ticket", required: false }),
        harness: params.harness({ label: "Harness", required: false }),
      },
      async run(ctx) {
        const { harness } = ctx.params;
        const workspaceId = workspaceIdFrom(ctx);
        const ticket = ticketRefFrom(ctx);
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
