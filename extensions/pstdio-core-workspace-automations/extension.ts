import { defineExtension, packageAsset, params } from "@pstdio/sdk/extensions";
import {
  createWorkspaceStatusDefinition,
  deleteWorkspaceStatusDefinition,
  ensureDefaultWorkspaceStatuses,
  readWorkspaceStatusData,
  reorderWorkspaceStatusDefinitions,
  setWorkspaceStatusValue,
  updateWorkspaceStatusDefinition,
} from "./src/workspace-status";
import { workspaceIdForStatusFrom } from "./src/workspace-status-helpers";

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

export default defineExtension({
  async initialSetup(ctx) {
    await ensureDefaultWorkspaceStatuses(ctx.storage);
  },

  settingsPanels: {
    workspaceStatuses: {
      title: "Workspace statuses",
      target: "workbench.settings",
      scope: "project",
      webview: {
        entry: packageAsset("./src/settings-panel.tsx", import.meta.url),
        capabilities: ["commands.execute"],
      },
    },
  },

  commands: {
    "workspaceStatus.read": {
      title: "Read workspace statuses",
      description: "Read workspace status definitions and workspace status values.",
      params: {
        workspaceIds: params.json<string[]>(),
      },
      async run(ctx) {
        return readWorkspaceStatusData({
          storage: ctx.storage,
          workspaceIds: ctx.params.workspaceIds,
        });
      },
    },
    "workspaceStatus.set": {
      title: "Set workspace status",
      description: "Set the status for a workspace.",
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
    },
    "workspaceStatus.create": {
      title: "Create workspace status",
      description: "Create a workspace status definition.",
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
    },
    "workspaceStatus.update": {
      title: "Update workspace status",
      description: "Update a workspace status definition.",
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
    },
    "workspaceStatus.delete": {
      title: "Delete workspace status",
      description: "Delete a workspace status definition.",
      params: {
        statusId: params.text({ label: "Status", required: true }),
      },
      async run(ctx) {
        return deleteWorkspaceStatusDefinition({
          statusId: ctx.params.statusId,
          storage: ctx.storage,
        });
      },
    },
    "workspaceStatus.reorder": {
      title: "Reorder workspace statuses",
      description: "Reorder workspace status definitions.",
      params: {
        statusIds: params.json<string[]>(),
      },
      async run(ctx) {
        return reorderWorkspaceStatusDefinitions({
          statusIds: ctx.params.statusIds ?? [],
          storage: ctx.storage,
        });
      },
    },
    runReview: {
      title: "Run review",
      description: "Start a code review session for a workspace.",
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
    },
  },
});
