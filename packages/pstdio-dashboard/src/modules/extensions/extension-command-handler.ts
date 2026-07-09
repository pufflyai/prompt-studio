import type {
  CommandExecuteResponse,
  ExtensionCommandPaletteContribution,
  ExtensionMenuContribution,
} from "@pstdio/sdk/api";
import { matchesResourceWhen } from "@pstdio/sdk/extensions";
import type {
  ResourceRef,
  WorkbenchCommandExecutionContext,
  WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";
import { dashboardCommandIds } from "@/shared/app/commands";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { collectExtensionCommandNotifications } from "@/shared/extensions/command-outcome";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import { buildExtensionCommandRequest } from "@/shared/extensions/slot-context";
import {
  type DashboardWorkspaceDiffSummary,
  formatDashboardWorkspaceDiffOverview,
  resolveDashboardWorkspaceDiffSummary,
} from "@/shared/workspaces/workspace-diff-summary-data";

export type ExecuteDashboardExtensionCommand = (
  projectId: string,
  commandId: string,
  body: unknown,
) => Promise<CommandExecuteResponse>;

type SessionCommandResult = {
  type: "session";
  id: string;
  title?: string;
  status?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const createDiffSummaryMetadata = (summary: DashboardWorkspaceDiffSummary) => ({
  diffOverview: formatDashboardWorkspaceDiffOverview(summary),
  diffAdditions: summary.additions,
  diffDeletions: summary.deletions,
  diffFileCount: summary.fileCount,
});

const resolveWorkspaceId = (resource: ResourceRef) => {
  const metadataWorkspaceId = resource.metadata?.workspaceId;
  if (typeof metadataWorkspaceId === "string") return metadataWorkspaceId;
  return resource.id;
};

const resolveExtensionResourceMetadata = async (resource: ResourceRef) => {
  const metadata: Record<string, unknown> = { ...(resource.metadata ?? {}) };

  if (resource.kind !== "workspace") return metadata;
  if (metadata.diffOverview !== undefined) return metadata;

  const workspaceId = resolveWorkspaceId(resource);
  if (!workspaceId || metadata.workspaceType === "current_branch") return metadata;

  const summary = await resolveDashboardWorkspaceDiffSummary(workspaceId).catch(() => null);
  return summary ? { ...metadata, ...createDiffSummaryMetadata(summary) } : metadata;
};

const toExtensionResourceContext = async (resource: ResourceRef, projectId: string) => {
  const extensionId = resource.metadata?.extensionId;
  const metadata = await resolveExtensionResourceMetadata(resource);

  return {
    type: resource.kind,
    id: resource.id ?? resource.uri,
    projectId,
    ...(resource.label ? { label: resource.label } : {}),
    ...(typeof extensionId === "string" ? { extensionId } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
};

const toSessionCommandResult = (value: unknown): SessionCommandResult | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record.type !== "session" || typeof record.id !== "string") return undefined;

  return {
    type: "session",
    id: record.id,
    ...(typeof record.title === "string" ? { title: record.title } : {}),
    ...(typeof record.status === "string" ? { status: record.status } : {}),
  };
};

const refreshSessionTrees = (ctx: WorkbenchModuleContributionContext) => {
  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
    ctx.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
  }
};

const openSessionCommandResult = async (
  ctx: WorkbenchModuleContributionContext,
  projectId: string,
  response: CommandExecuteResponse,
) => {
  if (!response.outcome.ok) return;

  const result = toSessionCommandResult(response.outcome.value);
  if (!result) return;

  refreshSessionTrees(ctx);
  if (!ctx.commands.getCommand(dashboardCommandIds.openFloatingSession)) return;

  await ctx.commands.executeCommand(dashboardCommandIds.openFloatingSession, {
    resource: createDashboardResource("session", result.id, result.title ?? "Session", "MessageCircle", projectId, {
      ...(result.status ? { status: result.status } : {}),
    }),
  });
};

export const createExtensionMenuCommandHandler = (input: {
  ctx: WorkbenchModuleContributionContext;
  contribution: ExtensionMenuContribution;
  executeCommand: ExecuteDashboardExtensionCommand;
  getActiveResource: () => ResourceRef | undefined;
  projectId: string;
}) => {
  const { ctx, contribution, executeCommand, getActiveResource, projectId } = input;

  return {
    execute: async (args: unknown, executionContext?: WorkbenchCommandExecutionContext) => {
      const activeResource = executionContext?.resource ?? getActiveResource();
      const resource = activeResource ? await toExtensionResourceContext(activeResource, projectId) : undefined;
      // Values collected by the params dialog arrive as `args`; merge them over the
      // contribution's preset params so the backend command receives the user input.
      const mergedParams = { ...contribution.params, ...(isRecord(args) ? args : undefined) };
      const response = await executeCommand(
        projectId,
        contribution.commandId,
        buildExtensionCommandRequest({
          projectId,
          slotId: contribution.slotId,
          kind: "menu",
          attachment: contribution.target
            ? { target: contribution.target, mode: ctx.modes.getActiveModeId() }
            : undefined,
          params: Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
          resource,
        }),
      );

      for (const notification of collectExtensionCommandNotifications(response)) {
        ctx.notifications.show({
          level: notification.level,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata,
        });
      }
      await openSessionCommandResult(ctx, projectId, response);
      publishExtensionCommandEvent(response);

      return response;
    },
  };
};

export const createExtensionCommandPaletteCommandHandler = (input: {
  ctx: WorkbenchModuleContributionContext;
  contribution: ExtensionCommandPaletteContribution;
  executeCommand: ExecuteDashboardExtensionCommand;
  getActiveResource: () => ResourceRef | undefined;
  projectId: string;
}) => {
  const { ctx, contribution, executeCommand, getActiveResource, projectId } = input;

  return {
    execute: async (args: unknown, executionContext?: WorkbenchCommandExecutionContext) => {
      const activeResource = executionContext?.resource ?? getActiveResource();
      const resource = activeResource ? await toExtensionResourceContext(activeResource, projectId) : undefined;
      const mergedParams = { ...contribution.params, ...(isRecord(args) ? args : undefined) };
      const response = await executeCommand(
        projectId,
        contribution.commandId,
        buildExtensionCommandRequest({
          projectId,
          slotId: "workbench.commandPalette",
          kind: "menu",
          params: Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
          resource,
        }),
      );

      for (const notification of collectExtensionCommandNotifications(response)) {
        ctx.notifications.show({
          level: notification.level,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata,
        });
      }
      await openSessionCommandResult(ctx, projectId, response);
      publishExtensionCommandEvent(response);

      return response;
    },
    isVisible: () => matchesResourceWhen(contribution.when, getActiveResource()?.kind),
  };
};
