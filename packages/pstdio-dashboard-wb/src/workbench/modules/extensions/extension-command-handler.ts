import type { CommandExecuteResponse, ExtensionMenuContribution } from "@pstdio/sdk/api";
import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { findDashboardWorkspace } from "../../data/dashboard-data";
import {
  type DashboardWorkspaceDiffSummary,
  formatDashboardWorkspaceDiffOverview,
  resolveDashboardWorkspaceDiffSummary,
} from "../../data/workspace-diff-summary-data";
import { collectExtensionCommandNotifications } from "../../shared/extensions/command-outcome";
import { publishExtensionCommandEvent } from "../../shared/extensions/extension-webview-broadcast";
import { buildExtensionCommandRequest } from "../../shared/extensions/slot-context";

export type ExecuteDashboardExtensionCommand = (
  projectId: string,
  commandId: string,
  body: unknown,
) => Promise<CommandExecuteResponse>;

const createDiffSummaryMetadata = (summary: DashboardWorkspaceDiffSummary) => ({
  diffOverview: formatDashboardWorkspaceDiffOverview(summary),
  diffAdditions: summary.additions,
  diffDeletions: summary.deletions,
  diffFileCount: summary.fileCount,
});

const resolveExtensionResourceMetadata = async (resource: ResourceRef, projectId: string) => {
  const workspace = resource.kind === "workspace" ? findDashboardWorkspace(resource, projectId) : undefined;
  const metadata: Record<string, unknown> = { ...(resource.metadata ?? {}), ...(workspace?.resource.metadata ?? {}) };

  if (resource.kind !== "workspace") return metadata;
  if (metadata.diffOverview !== undefined) return metadata;

  const workspaceId = workspace?.id ?? resource.id;
  if (!workspaceId || workspace?.type === "current_branch") return metadata;

  const summary = await resolveDashboardWorkspaceDiffSummary(workspaceId).catch(() => null);
  return summary ? { ...metadata, ...createDiffSummaryMetadata(summary) } : metadata;
};

const toExtensionResourceContext = async (resource: ResourceRef, projectId: string) => {
  const extensionId = resource.metadata?.extensionId;
  const metadata = await resolveExtensionResourceMetadata(resource, projectId);

  return {
    type: resource.kind,
    id: resource.id ?? resource.uri,
    projectId,
    ...(resource.label ? { label: resource.label } : {}),
    ...(typeof extensionId === "string" ? { extensionId } : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
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
    execute: async () => {
      const activeResource = getActiveResource();
      const response = await executeCommand(
        projectId,
        contribution.commandId,
        buildExtensionCommandRequest({
          projectId,
          slotId: contribution.slotId,
          kind: "menu",
          params: contribution.params,
          resource: activeResource ? await toExtensionResourceContext(activeResource, projectId) : undefined,
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
      publishExtensionCommandEvent(response);

      return response;
    },
  };
};
