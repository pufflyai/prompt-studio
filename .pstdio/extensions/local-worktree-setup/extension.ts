import { defineCommand, defineExtension, params, worktreeEvents } from "@pstdio/sdk/extensions";

const INSTALL_COMMAND = ["bun", "install", "--frozen-lockfile"];
const BUILD_COMMAND = ["bun", "run", "build"];
const ISOLATED_COMMAND = ["bun", "run", "dev:isolated"];

const dashboardUrlFrom = (output: string) => {
  const match = output.match(/Dashboard:\s*(https?:\/\/\S+)/);
  if (!match) throw new Error("Dashboard URL was not printed by the isolated dev command.");
  return match[1];
};

const stackNameFrom = (workspaceId: string) => `pstdio-${workspaceId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;

export const browserOpenCommand = (url: string, platform = process.platform as string) => {
  if (platform === "darwin") return ["open", url];
  if (platform === "win32") return ["cmd", "/c", "start", "", url];
  return ["xdg-open", url];
};

const workspaceIdFrom = (ctx: { params: { workspaceId?: string }; resource?: { type: string; id: string } }) => {
  const workspaceId = ctx.params.workspaceId?.trim();
  if (workspaceId) return workspaceId;
  if (ctx.resource?.type !== "workspace") throw new Error("Workspace is required.");
  return ctx.resource.id;
};

export default defineExtension({
  commands: {
    "workspace.openInVscode": defineCommand({
      title: "Open workspace in VS Code",
      cli: true,
      menus: [
        {
          target: "workbench.nav.overflow",
          label: "Open in VS Code",
          icon: "code",
          when: { resourceType: ["workspace"] },
        },
      ],
      params: {
        workspaceId: params.text({ label: "Workspace ID", required: false }),
      },
      async run(ctx) {
        const workspaceId = workspaceIdFrom(ctx);
        const workspace = await ctx.workspaces.get(workspaceId);
        const worktreePath = workspace?.worktree_path?.trim();
        if (!worktreePath) throw new Error("Workspace worktree path is required.");

        await ctx.process.spawnDetached({
          command: ["code", worktreePath],
          cwd: worktreePath,
        });

        return { worktreePath };
      },
    }),
    "workspace.openInIsolation": defineCommand({
      title: "Open workspace in isolation",
      cli: true,
      menus: [
        {
          target: "workbench.nav.overflow",
          label: "Open in isolation",
          icon: "container",
          when: { resourceType: ["workspace"] },
        },
      ],
      params: {
        workspaceId: params.text({ label: "Workspace ID", required: false }),
      },
      async run(ctx) {
        const workspaceId = workspaceIdFrom(ctx);
        const workspace = await ctx.workspaces.get(workspaceId);
        const worktreePath = workspace?.worktree_path?.trim();
        if (!worktreePath) throw new Error("Workspace worktree path is required.");

        const stackName = stackNameFrom(workspaceId);
        const result = await ctx.process.runOrThrow({
          command: [...ISOLATED_COMMAND, "--", "--name", stackName],
          cwd: worktreePath,
        });
        const dashboardUrl = dashboardUrlFrom(result.stdout);

        await ctx.process.spawnDetached({
          command: browserOpenCommand(dashboardUrl),
          cwd: worktreePath,
        });

        return { dashboardUrl, stackName, worktreePath };
      },
    }),
    "workspace.stopIsolation": defineCommand({
      title: "Stop workspace isolation",
      cli: true,
      menus: [
        {
          target: "workbench.nav.overflow",
          label: "Stop isolation",
          icon: "square",
          when: { resourceType: ["workspace"] },
        },
      ],
      params: {
        workspaceId: params.text({ label: "Workspace ID", required: false }),
      },
      async run(ctx) {
        const workspaceId = workspaceIdFrom(ctx);
        const workspace = await ctx.workspaces.get(workspaceId);
        const worktreePath = workspace?.worktree_path?.trim();
        if (!worktreePath) throw new Error("Workspace worktree path is required.");

        const stackName = stackNameFrom(workspaceId);
        await ctx.process.runOrThrow({
          command: [...ISOLATED_COMMAND, "--", "--name", stackName, "--down"],
          cwd: worktreePath,
        });

        return { stackName, worktreePath };
      },
    }),
  },
  hooks: {
    worktreeCreated: {
      event: worktreeEvents.created,
      async handler(ctx, payload) {
        await ctx.process.runOrThrow({
          command: INSTALL_COMMAND,
          cwd: payload.worktreePath,
        });

        await ctx.process.runOrThrow({
          command: BUILD_COMMAND,
          cwd: payload.worktreePath,
        });
      },
    },
  },
});
