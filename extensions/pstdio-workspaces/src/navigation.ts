import {
  defineCommand,
  params,
  workbenchCommands,
  workbenchPages,
  workbenchResourceKinds,
  workspaceSlots,
} from "@pstdio/sdk/extensions";
import { sessionTarget, workspaceTarget } from "./model";
import { listSessions } from "./query";
import { workspacePages } from "./refs";
export const open = defineCommand({
  id: "open",
  title: "Open workspace",
  menus: [
    {
      slot: workspaceSlots.headerOverflow,
      icon: "folder-open",
      when: { resourceType: [workbenchResourceKinds.workspace] },
    },
  ],
  cli: true,
  params: { id: params.text({ resolvedFrom: "resource" }), selected: params.text() },
  async run(ctx, args) {
    const id = args.id ?? ctx.resource?.id;
    if (!id) {
      ctx.navigation.open({ kind: "page", page: workspacePages.list });
      return;
    }
    const workspace = await ctx.workspaces.get(id);
    if (!workspace) throw new Error("Workspace not found.");
    ctx.navigation.open(
      workspaceTarget(workspace, ctx.project.id, args.selected ? { workspaceFilePath: args.selected } : {}),
    );
  },
});
export const openFiles = defineCommand({
  id: "open-files",
  title: "Open project files",
  cli: true,
  palette: [{ group: "Workspaces" }],
  async run(ctx) {
    const workspace = await ctx.workspaces.getDefault();
    if (!workspace) {
      ctx.navigation.open({ kind: "command", target: { command: workbenchCommands.chooseProjectFolder } });
      return;
    }
    ctx.navigation.open(workspaceTarget(workspace, ctx.project.id));
  },
});
export const openSession = defineCommand({
  id: "open-session",
  title: "Open session",
  menus: [
    {
      slot: workspaceSlots.headerOverflow,
      icon: "message-square",
      when: { resourceType: [workbenchResourceKinds.workspace], metadata: { workspaceReadOnly: false } },
    },
  ],
  cli: true,
  params: { id: params.text({ resolvedFrom: "resource" }) },
  async run(ctx, args) {
    const workspace = await ctx.workspaces.get(args.id ?? ctx.resource?.id ?? "");
    if (!workspace) throw new Error("Workspace not found.");
    const sessions = await listSessions(ctx, workspace.id);
    if (sessions[0]) {
      ctx.navigation.open(sessionTarget(sessions[0], ctx.project.id));
      return;
    }
    if (workspace.device) {
      ctx.navigation.open(workspaceTarget(workspace, ctx.project.id));
      return;
    }
    ctx.navigation.open({
      kind: "page",
      page: workbenchPages.newSession,
      resource: {
        type: "session-draft",
        extensionId: "pstdio",
        projectId: ctx.project.id,
        id: crypto.randomUUID(),
        metadata: {
          workspaceId: workspace.id,
          workspaceShorthand: workspace.shorthand ?? "",
          workspaceTitle: workspace.name ?? "",
          workspaceBranch: workspace.branch ?? "",
        },
      },
    });
  },
});
export const device = defineCommand({
  id: "device",
  title: "Device details",
  cli: true,
  params: { deviceId: params.text({ required: true }) },
  run(ctx) {
    ctx.navigation.open({ kind: "page", page: workspacePages.list });
  },
});

export const openHistory = defineCommand({
  id: "open-history",
  title: "Open session history",
  cli: true,
  menus: [
    {
      slot: workspaceSlots.headerOverflow,
      icon: "history",
      when: { resourceType: [workbenchResourceKinds.workspace], metadata: { workspaceReadOnly: true } },
    },
  ],
  async run(ctx) {
    if (!ctx.resource?.id) throw new Error("Choose a workspace.");
    const workspace = await ctx.workspaces.get(ctx.resource.id);
    if (!workspace) throw new Error("Workspace not found.");
    ctx.navigation.open({
      kind: "page",
      page: workspacePages.history,
      resource: workspaceTarget(workspace, ctx.project.id).resource,
    });
  },
});

export const openTerminal = defineCommand({
  id: "open-terminal",
  title: "Open terminal",
  cli: true,
  menus: [
    {
      slot: workspaceSlots.headerOverflow,
      icon: "square-terminal",
      when: {
        resourceType: [workbenchResourceKinds.workspace],
        metadata: { workspaceReadOnly: false, workspaceExecutionKind: "local", workspaceProviderState: "ready" },
      },
    },
  ],
  async run(ctx) {
    const workspace = await ctx.workspaces.get(ctx.resource?.id ?? "");
    if (
      !workspace ||
      workspace.device ||
      workspace.executionKind !== "local" ||
      workspace.providerState !== "ready" ||
      workspace.initializing ||
      workspace.setupError ||
      !workspace.rootPath
    )
      throw new Error("Workspace execution is unavailable.");
    ctx.navigation.open({
      kind: "command",
      target: { command: workbenchCommands.openWorkspaceTerminal, params: { workspaceId: workspace.id } },
    });
  },
});
