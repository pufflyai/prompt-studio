import { commandRef, defineCommand, defineExtension, eventRef, params, workspaceSlots } from "@pstdio/sdk/extensions";

interface WorkspaceReadyPayload {
  workspaceDir: string;
}

const WORKSPACE_READY_EVENT = eventRef<WorkspaceReadyPayload>("workspace.ready");

const INSTALL_COMMAND = ["bun", "install", "--frozen-lockfile"];
const BUILD_COMMAND = ["bun", "run", "build"];
// Chained via a shell because spawnDetached runs a single executable (no shell operators).
const PROVISION_COMMAND = ["sh", "-c", `${INSTALL_COMMAND.join(" ")} && ${BUILD_COMMAND.join(" ")}`];
const ISOLATED_COMMAND = ["bun", "run", "dev:isolated"];
const FIND_CHORE_IMPROVEMENTS_COMMAND = commandRef("pstdio-dev.chore.findImprovements");
const CHORE_DISCOVERY_PROMPT = [
  "Inspect this repository for chore improvements worth tracking.",
  "Look for maintenance, cleanup, test, documentation, or developer-experience work that should be tracked separately.",
  "Choose one high-signal chore, then create a planner ticket for it with the `pst tickets` CLI.",
  "If you draft the ticket locally first, run `pst tickets save` before finishing.",
  "Do not make source changes in this session.",
].join("\n");

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
    "chore.findImprovements": defineCommand({
      title: "Find chore improvements",
      async run(ctx) {
        const session = await ctx.sessions.create({
          title: "Find chore improvements",
          prompt: CHORE_DISCOVERY_PROMPT,
        });

        return { sessionId: session.id };
      },
    }),
    "workspace.openInVscode": defineCommand({
      title: "Open workspace in VS Code",
      cli: true,
      menus: [
        {
          slot: workspaceSlots.headerOverflow,
          label: "Open in VS Code",
          icon: "code",
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
          slot: workspaceSlots.headerOverflow,
          label: "Open in isolation",
          icon: "container",
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
          slot: workspaceSlots.headerOverflow,
          label: "Stop isolation",
          icon: "square",
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
  schedules: {
    dailyChoreDiscovery: {
      title: "Daily chore discovery",
      cron: "0 12 * * *",
      command: FIND_CHORE_IMPROVEMENTS_COMMAND,
    },
  },
  hooks: {
    // Install + build run in the background so session launch isn't blocked on them.
    workspaceReady: {
      event: WORKSPACE_READY_EVENT,
      async handler(ctx, payload) {
        await ctx.process.spawnDetached({
          command: PROVISION_COMMAND,
          cwd: payload.workspaceDir,
        });
      },
    },
  },
});
