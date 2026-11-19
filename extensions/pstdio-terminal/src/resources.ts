import { defineCommandPaletteResource, l10n, type ResourceRef, viewDataEvents } from "@pstdio/sdk/extensions";
import { terminalPlacement, terminalResource } from "./terminal";

export const terminals = defineCommandPaletteResource({
  id: "terminals",
  title: l10n("terminal.title", "Terminal"),
  resourceKind: terminalResource.ref,
  refreshEvents: [viewDataEvents.workspacesChanged],
  async query(ctx, input) {
    const query = input.query.trim().toLowerCase();
    const workspaces = (await ctx.workspaces.list()).filter(
      (workspace) =>
        workspace.executionKind === "local" &&
        workspace.providerState === "ready" &&
        workspace.rootPath &&
        !workspace.device &&
        !workspace.initializing &&
        !workspace.setupError,
    );
    const items = [];
    for (const workspace of workspaces) {
      const label = workspace.name ?? workspace.shorthand ?? "Project";
      const resource = (await ctx.storage.get<ResourceRef>(`last-terminal:${workspace.id}`)) ?? {
        type: terminalResource.id,
        id: `workspace:${workspace.id}`,
        projectId: ctx.projectId,
        extensionId: ctx.extensionId,
        label: "Terminal",
        icon: "square-terminal",
        metadata: { workspaceId: workspace.id },
      };
      const searchable = [label, workspace.shorthand, resource.label, resource.shorthand, "terminal"].join(" ");
      if (query && !searchable.toLowerCase().includes(query)) continue;
      items.push({
        id: resource.id,
        label: resource.label ?? "Terminal",
        description: label,
        icon: "square-terminal",
        target: { kind: "panel" as const, panel: terminalPlacement.ref, resource, open: "pin" as const },
      });
      if (items.length >= input.limit) break;
    }
    return { items };
  },
});
