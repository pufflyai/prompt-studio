import { defineCommand, l10n, type RelatedResourceOpenings } from "@pstdio/sdk/extensions";

export const ticketRelatedOpeningsCommand = defineCommand({
  id: "ticket-related-openings",
  title: l10n("commands.ticketRelatedOpenings.title", "Select related ticket resources"),
  async run(ctx) {
    const source = ctx.resource;
    if (source?.type !== "ticket") return [];
    const { items } = await ctx.sessions.query({
      anchor: {
        type: source.type,
        id: source.id,
        extensionId: source.extensionId ?? ctx.extensionId,
        projectId: source.projectId ?? ctx.projectId,
      },
      orderBy: "lastActivity",
      limit: 1,
    });
    const session = items[0];
    if (!session) return [];
    return [
      {
        resource: {
          type: "session",
          id: session.id,
          extensionId: "pstdio",
          projectId: ctx.projectId,
          label: session.title,
          icon: "MessageCircle",
        },
        autoOpen: true,
        region: "side",
        open: "preview",
      },
    ] satisfies RelatedResourceOpenings;
  },
});
