import { defineCommand, l10n } from "@pstdio/sdk/extensions";

export const cloudCommands = {
  "extension-sources": defineCommand({
    id: "extension-sources",
    title: l10n("commands.extensionSources", "List installed tools for team management"),
    cli: true,
    async run(ctx) {
      if (!ctx.extensions) throw new Error("This host does not support extension management.");
      const { extensions } = await ctx.extensions.list();
      return extensions
        .filter((extension) => extension.enabled && extension.status === "loaded")
        .map((extension) => ({
          instanceId: extension.id,
          extensionId: extension.extensionId,
          name: extension.displayName,
          version: extension.version,
          icon: extension.icon,
        }));
    },
  }),
  "project-name": defineCommand({
    id: "project-name",
    title: l10n("commands.projectName", "Read project name"),
    run: (ctx) => ctx.project.name,
  }),
  "project-state": defineCommand({
    id: "project-state",
    title: l10n("commands.projectState", "Read project preparation"),
    cli: true,
    async run(ctx) {
      const workspace = await ctx.workspaces.getDefault();
      if (workspace?.setupError || ["failed", "provider_missing"].includes(workspace?.providerState ?? ""))
        return { state: "failed" as const, error: workspace?.setupError ?? "Project setup failed" };
      const ready =
        workspace &&
        !workspace.initializing &&
        (workspace.providerState ?? "ready") === "ready" &&
        (workspace.executionKind === "remote" || Boolean(workspace.rootPath));
      return { state: ready ? ("ready" as const) : ("preparing" as const) };
    },
  }),
};
export type CloudProjectState = Awaited<ReturnType<(typeof cloudCommands)["project-state"]["run"]>>;
