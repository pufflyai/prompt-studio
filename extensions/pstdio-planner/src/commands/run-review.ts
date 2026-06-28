import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";

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
  if (ctx.resource?.type !== "workspace") return undefined;
  return stringMetadata(ctx.resource.metadata, "workspaceId") ?? ctx.resource.id;
};

const ticketRefFrom = (ctx: {
  params: { ticket?: string };
  resource?: { type: string; label?: string; metadata?: Record<string, unknown> };
}) => ctx.params.ticket?.trim() ?? stringMetadata(ctx.resource?.metadata, "ticket") ?? ctx.resource?.label?.trim();

// Operator-triggered code review. Spawns a review-code session scoped to the
// given workspace + ticket; the automations extension calls this as the
// "review" step of its review loop.
export const runReviewCommand = defineCommand({
  title: l10n("commands.runReview.title", "Run review"),
  cli: true,
  menus: [
    {
      target: "workbench.nav.overflow",
      label: l10n("commands.runReview.menuLabel", "Run review"),
      icon: "clipboard-check",
      when: { resourceType: ["workspace"] },
    },
  ],
  params: {
    workspaceId: params.text({ label: "Workspace", required: false }),
    ticket: params.text({ label: "Ticket", required: false }),
    harness: params.harness({ label: "Harness", required: false }),
  },
  async run(ctx) {
    const { harness } = ctx.params;
    const workspaceId = workspaceIdFrom(ctx);
    const ticket = ticketRefFrom(ctx);
    await ctx.sessions.create({
      ...(workspaceId ? { workspaceId } : {}),
      title: `Code review: ${ticket || "ticket"}`,
      ...(harness ? { harness } : {}),
      template: "review-code",
      vars: ticket ? { ticket } : {},
    });
  },
});
