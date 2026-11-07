import { defineCommand, l10n } from "@pstdio/sdk/extensions";

export const relatedOpenings = defineCommand({
  id: "related-openings",
  title: l10n("command.relatedOpenings", "Related workspace resources"),
  cli: true,
  async run(ctx) {
    const resource = ctx.resource;
    if (resource?.extensionId !== "pstdio" || resource.type !== "workspace") return [];
    const { items } = await ctx.sessions.query({ workspaceId: resource.id, limit: 1, orderBy: "lastActivity" });
    const latest = items[0];
    return latest
      ? [
          {
            resource: {
              type: "session",
              extensionId: "pstdio",
              projectId: ctx.project.id,
              id: latest.id,
              label: latest.title,
              ...(latest.device ? { device: latest.device } : {}),
            },
            autoOpen: true,
            region: "side" as const,
            open: "preview" as const,
          },
        ]
      : [];
  },
});
