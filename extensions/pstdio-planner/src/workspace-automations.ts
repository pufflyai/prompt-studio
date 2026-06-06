import { defineCommand, packageAsset, params, type SettingsPanelContribution } from "@pstdio/sdk/extensions";
import {
  createWorkspaceStatusDefinition,
  deleteWorkspaceStatusDefinition,
  ensureDefaultWorkspaceStatuses,
  readWorkspaceStatusData,
  reorderWorkspaceStatusDefinitions,
  setWorkspaceStatusValue,
  updateWorkspaceStatusDefinition,
} from "./workspace-statuses/workspace-status";
import { workspaceIdForStatusFrom } from "./workspace-statuses/workspace-status-helpers";

const stringMetadata = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const workspaceIdFrom = (ctx: {
  params: { workspaceId?: string };
  resource?: { type: string; id: string; metadata?: Record<string, unknown> };
}) => {
  const workspaceId = ctx.params.workspaceId?.trim();
  if (workspaceId) return workspaceId;
  if (ctx.resource?.type !== "workspace") throw new Error("Workspace is required.");
  return stringMetadata(ctx.resource.metadata, "workspaceId") ?? ctx.resource.id;
};

const ticketRefFrom = (ctx: {
  params: { ticket?: string };
  resource?: { type: string; label?: string; metadata?: Record<string, unknown> };
}) => {
  return ctx.params.ticket?.trim() ?? stringMetadata(ctx.resource?.metadata, "ticket") ?? ctx.resource?.label?.trim();
};

export const setupWorkspaceAutomations = async (ctx: {
  storage: Parameters<typeof ensureDefaultWorkspaceStatuses>[0];
}) => {
  await ensureDefaultWorkspaceStatuses(ctx.storage);
};

export const workspaceAutomationSettingsPanels = {
  workspaceStatuses: {
    title: "Workspace statuses",
    target: "workbench.settings",
    scope: "project",
    webview: {
      entry: packageAsset("./workspace-statuses/settings-panel.tsx", import.meta.url),
      capabilities: ["commands.execute"],
    },
  },
} satisfies Record<string, SettingsPanelContribution>;

export const workspaceAutomationCommands = {
  "workspaceStatus.read": defineCommand({
    title: "Read workspace statuses",
    params: {
      workspaceIds: params.json<string[]>(),
    },
    async run(ctx) {
      return readWorkspaceStatusData({
        storage: ctx.storage,
        workspaceIds: ctx.params.workspaceIds,
      });
    },
  }),
  "workspaceStatus.set": defineCommand({
    title: "Set workspace status",
    cli: {
      globalAliases: [["workspaces", "set-status"]],
      examples: ["pstdio workspaces set-status --workspace PS-1_A1 --status review-ready"],
    },
    params: {
      workspace: params.text({ label: "Workspace", required: false }),
      workspaceId: params.text({ label: "Workspace ID", required: false }),
      status: params.text({ label: "Status", required: true }),
    },
    async run(ctx) {
      return setWorkspaceStatusValue({
        storage: ctx.storage,
        status: ctx.params.status,
        workspaceId: await workspaceIdForStatusFrom(ctx),
      });
    },
  }),
  "workspaceStatus.create": defineCommand({
    title: "Create workspace status",
    params: {
      label: params.text({ label: "Label", required: true }),
      color: params.text({ label: "Color", required: false }),
      icon: params.text({ label: "Icon", required: false }),
    },
    async run(ctx) {
      return createWorkspaceStatusDefinition({
        color: ctx.params.color,
        icon: ctx.params.icon ?? null,
        label: ctx.params.label,
        storage: ctx.storage,
      });
    },
  }),
  "workspaceStatus.update": defineCommand({
    title: "Update workspace status",
    params: {
      statusId: params.text({ label: "Status", required: true }),
      label: params.text({ label: "Label", required: false }),
      color: params.text({ label: "Color", required: false }),
      icon: params.text({ label: "Icon", required: false }),
    },
    async run(ctx) {
      return updateWorkspaceStatusDefinition({
        color: ctx.params.color,
        icon: ctx.params.icon ?? null,
        label: ctx.params.label,
        statusId: ctx.params.statusId,
        storage: ctx.storage,
      });
    },
  }),
  "workspaceStatus.delete": defineCommand({
    title: "Delete workspace status",
    params: {
      statusId: params.text({ label: "Status", required: true }),
    },
    async run(ctx) {
      return deleteWorkspaceStatusDefinition({
        statusId: ctx.params.statusId,
        storage: ctx.storage,
      });
    },
  }),
  "workspaceStatus.reorder": defineCommand({
    title: "Reorder workspace statuses",
    params: {
      statusIds: params.json<string[]>(),
    },
    async run(ctx) {
      return reorderWorkspaceStatusDefinitions({
        statusIds: ctx.params.statusIds ?? [],
        storage: ctx.storage,
      });
    },
  }),
  runReview: defineCommand({
    title: "Run review",
    cli: true,
    menus: [{ target: "workbench.nav.actions", label: "Run review", when: { resourceType: ["workspace"] } }],
    params: {
      workspaceId: params.text({ label: "Workspace", required: true }),
      ticket: params.text({ label: "Ticket", required: false }),
      harness: params.harness({ label: "Harness", required: false }),
    },
    async run(ctx) {
      const { harness } = ctx.params;
      const workspaceId = workspaceIdFrom(ctx);
      const ticket = ticketRefFrom(ctx);
      await ctx.sessions.create({
        workspaceId,
        title: `Code review: ${ticket || "ticket"}`,
        harness,
        template: "review-code",
        vars: ticket ? { ticket } : {},
      });
    },
  }),
};
