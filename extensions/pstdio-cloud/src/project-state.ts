import { defineCommand, l10n } from "@pstdio/sdk/extensions";

export const cloudCommands = {
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
