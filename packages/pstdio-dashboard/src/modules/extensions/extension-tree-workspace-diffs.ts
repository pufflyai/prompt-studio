import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import {
  type DashboardWorkspaceDiffSummary,
  formatDashboardWorkspaceDiffOverview,
  resolveDashboardWorkspaceDiffSummary,
} from "@/shared/workspaces/workspace-diff-summary-data";

type ResolveWorkspaceDiffSummary = (workspaceId: string) => Promise<DashboardWorkspaceDiffSummary | null>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const diffMetadata = (summary: DashboardWorkspaceDiffSummary) => ({
  diffOverview: formatDashboardWorkspaceDiffOverview(summary),
  diffAdditions: summary.additions,
  diffDeletions: summary.deletions,
  diffFileCount: summary.fileCount,
});

const withResourceDiffMetadata = async (value: unknown, resolveSummary: ResolveWorkspaceDiffSummary) => {
  if (!isRecord(value) || value.type !== "workspace" || typeof value.id !== "string") return value;

  const summary = await resolveSummary(value.id).catch(() => null);
  if (!summary) return value;

  return {
    ...value,
    metadata: {
      ...(isRecord(value.metadata) ? value.metadata : {}),
      ...diffMetadata(summary),
    },
  };
};

const withNodeDiffMetadata = async (value: unknown, resolveSummary: ResolveWorkspaceDiffSummary): Promise<unknown> => {
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = { ...value };
  if (isRecord(next.target)) {
    next.target = {
      ...next.target,
      resource: await withResourceDiffMetadata(next.target.resource, resolveSummary),
    };
  }
  next.resource = await withResourceDiffMetadata(next.resource, resolveSummary);
  if (Array.isArray(next.children)) {
    next.children = await Promise.all(next.children.map((child) => withNodeDiffMetadata(child, resolveSummary)));
  }

  return next;
};

const withSectionDiffMetadata = async (value: unknown, resolveSummary: ResolveWorkspaceDiffSummary) => {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return value;

  return {
    ...value,
    nodes: await Promise.all(value.nodes.map((node) => withNodeDiffMetadata(node, resolveSummary))),
  };
};

export const withWorkspaceDiffMetadata = async (
  response: CommandExecuteResponse,
  resolveSummary: ResolveWorkspaceDiffSummary = resolveDashboardWorkspaceDiffSummary,
): Promise<CommandExecuteResponse> => {
  if (!response.outcome.ok || !Array.isArray(response.outcome.value)) return response;

  return {
    ...response,
    outcome: {
      ...response.outcome,
      value: await Promise.all(
        response.outcome.value.map((section) => withSectionDiffMetadata(section, resolveSummary)),
      ),
    },
  };
};
