import { defineCommandPaletteResource } from "@pstdio/sdk/extensions";
import { refreshEvents } from "./events";
import { workspaceTarget } from "./model";
export const fileSearch = defineCommandPaletteResource({
  id: "files",
  title: "Workspace files",
  refreshEvents,
  async query(ctx, { activeResource, query, limit }) {
    const workspace =
      activeResource?.type === "workspace"
        ? await ctx.workspaces.get(activeResource.id!)
        : await ctx.workspaces.getDefault();
    if (
      !workspace ||
      workspace.device ||
      workspace.providerState !== "ready" ||
      workspace.executionKind !== "local" ||
      workspace.capabilities?.files === "none"
    )
      return { items: [] };
    const result = await ctx.workspaces.listFiles(workspace.id, { query, limit: Math.min(500, limit) });
    return {
      items: result.entries
        .filter((entry) => entry.type === "file")
        .map((entry) => ({
          id: `${workspace.id}:${entry.path}`,
          label: entry.name,
          description: entry.path,
          icon: "file",
          keywords: [entry.path],
          target: workspaceTarget(workspace, ctx.project.id, { workspaceFilePath: entry.path }),
        })),
    };
  },
});
