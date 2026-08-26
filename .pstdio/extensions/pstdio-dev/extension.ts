import {
  defineCommand,
  defineExtension,
  defineHook,
  defineSchedule,
  params,
  workspaceEvents,
  workspaceSlots,
} from "@pstdio/sdk/extensions";

const INSTALL_COMMAND = ["bun", "install", "--frozen-lockfile"];
const BUILD_COMMAND = ["bun", "run", "build"];
// Chained via a shell because spawnDetached runs a single executable (no shell operators).
const PROVISION_COMMAND = ["sh", "-c", `${INSTALL_COMMAND.join(" ")} && ${BUILD_COMMAND.join(" ")}`];
const ISOLATED_COMMAND = ["bun", "run", "dev:isolated"];
const HIGH_IMPACT_ISSUE_DISCOVERY_PROMPT = [
  "Inspect this repository for one high-impact user-facing bug, reliability failure, data-loss risk, security weakness, or material violation of its documented architecture.",
  "Read the applicable AGENTS.md files and relevant documents under .pstdio/docs/architecture/. Run `bun run verify:boundaries`, then inspect documented ownership, layering, dependency direction, public/private package boundaries, and declared sources of truth. Treat only those documents and architecture checks as authoritative; do not invent architecture rules or propose preference-based rewrites.",
  "Apply these gates in order:",
  "1. Identify a plausible high-impact bug, security, reliability, data-integrity, or documented architecture-conformance issue. Reject routine maintenance, cleanup, documentation, test-only, dependency-hygiene, cosmetic, and developer-experience chores unless they demonstrate a material architecture violation.",
  "2. Check existing open and archived planner tickets. Stop if an equivalent issue is already tracked, was archived after being addressed, or was previously rejected; use the archived ticket's history and rejection rationale instead of recreating it.",
  "3. Reproduce the candidate safely with a focused existing test, diagnostic command, deterministic steps, failing architecture check, or a concrete code trace against a documented rule. Do not perform destructive, production-facing, or exploitative security validation. An unverified hypothesis does not qualify.",
  "4. Establish material impact and actionability for users, security, data integrity, reliability, or architecture before creating anything.",
  "5. Only when every gate passes, create exactly one evidence-backed planner ticket with the `pst tickets` CLI and save it with `pst tickets save`.",
  "For a reproduced defect, record the reproduction steps or failing command, observed result, expected result, material impact, relevant code area, and validation direction.",
  "For an architecture infraction, cite the governing rule, offending dependency or code path, concrete evidence, architectural risk, and intended boundary to restore.",
  "If any gate fails or no valuable reproduced fix is found, report that outcome and create no ticket. A no-ticket result is a successful run.",
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

const workspaceIdFrom = (ctx: { resource?: { type: string; id: string } }, commandParams: { workspaceId?: string }) => {
  const workspaceId = commandParams.workspaceId?.trim();
  if (workspaceId) return workspaceId;
  if (ctx.resource?.type !== "workspace") throw new Error("Workspace is required.");
  return ctx.resource.id;
};

const discoverHighImpactIssuesCommand = defineCommand({
  id: "issues.discoverHighImpact",
  title: "Discover high-impact issues",
  async run(ctx, _commandParams) {
    const session = await ctx.sessions.create({
      title: "Discover high-impact issues",
      prompt: HIGH_IMPACT_ISSUE_DISCOVERY_PROMPT,
    });

    return { sessionId: session.id };
  },
});

const openInVscodeCommand = defineCommand({
  id: "workspace.openInVscode",
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
  async run(ctx, commandParams) {
    const workspaceId = workspaceIdFrom(ctx, commandParams);
    const workspace = await ctx.workspaces.get(workspaceId);
    const worktreePath = workspace?.worktree_path?.trim();
    if (!worktreePath) throw new Error("Workspace worktree path is required.");

    await ctx.process.spawnDetached({
      command: ["code", worktreePath],
      cwd: worktreePath,
    });

    return { worktreePath };
  },
});

const openInIsolationCommand = defineCommand({
  id: "workspace.openInIsolation",
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
  async run(ctx, commandParams) {
    const workspaceId = workspaceIdFrom(ctx, commandParams);
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
});

const stopIsolationCommand = defineCommand({
  id: "workspace.stopIsolation",
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
  async run(ctx, commandParams) {
    const workspaceId = workspaceIdFrom(ctx, commandParams);
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
});

export default defineExtension({
  commands: [discoverHighImpactIssuesCommand, openInVscodeCommand, openInIsolationCommand, stopIsolationCommand],
  schedules: [
    defineSchedule({
      id: "dailyIssueDiscovery",
      title: "Daily high-impact issue discovery",
      schedule: "0 12 * * *",
      command: discoverHighImpactIssuesCommand.ref,
    }),
  ],
  hooks: [
    // Install + build run in the background so session launch isn't blocked on them.
    defineHook({
      id: "workspaceReady",
      event: workspaceEvents.ready,
      async run(ctx, payload) {
        await ctx.process.spawnDetached({
          command: PROVISION_COMMAND,
          cwd: payload.workspaceDir,
        });
      },
    }),
  ],
});
