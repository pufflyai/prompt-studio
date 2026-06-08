import { defineCommand, defineExtension, params, worktreeEvents } from "@pstdio/sdk/extensions";

const INSTALL_COMMAND = ["bun", "install", "--frozen-lockfile"];
const BUILD_COMMAND = ["bun", "run", "build"];

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
      menus: [{ target: "workbench.nav.actions", label: "Open in VS Code", when: { resourceType: ["workspace"] } }],
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
