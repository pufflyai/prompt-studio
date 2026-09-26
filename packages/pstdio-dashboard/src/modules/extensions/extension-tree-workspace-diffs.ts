import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import {
  type DashboardWorkspaceDiffSummary,
  formatDashboardWorkspaceDiffOverview,
  resolveDashboardWorkspaceDiffSummary,
} from "@/shared/workspaces/workspace-diff-summary-data";

type ResolveWorkspaceDiffSummary = (
  workspaceId: string,
  signal?: AbortSignal,
) => Promise<DashboardWorkspaceDiffSummary | null>;

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

  const summary = await resolveSummary(value.id);
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
    const children: unknown[] = [];
    for (const child of next.children) children.push(await withNodeDiffMetadata(child, resolveSummary));
    next.children = children;
  }

  return next;
};

const withSectionDiffMetadata = async (value: unknown, resolveSummary: ResolveWorkspaceDiffSummary) => {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return value;

  const nodes: unknown[] = [];
  for (const node of value.nodes) nodes.push(await withNodeDiffMetadata(node, resolveSummary));
  return {
    ...value,
    nodes,
  };
};

export const withWorkspaceDiffMetadata = async (
  response: CommandExecuteResponse,
  resolveSummary: ResolveWorkspaceDiffSummary = resolveDashboardWorkspaceDiffSummary,
  signal?: AbortSignal,
): Promise<CommandExecuteResponse> => {
  if (!response.outcome.ok || !Array.isArray(response.outcome.value)) return response;

  const resolve: ResolveWorkspaceDiffSummary = async (id) => {
    signal?.throwIfAborted();
    try {
      return await resolveSummary(id, signal);
    } catch {
      signal?.throwIfAborted();
      return null;
    }
  };
  const sections: unknown[] = [];
  for (const section of response.outcome.value) sections.push(await withSectionDiffMetadata(section, resolve));
  signal?.throwIfAborted();
  return {
    ...response,
    outcome: {
      ...response.outcome,
      value: sections,
    },
  };
};
