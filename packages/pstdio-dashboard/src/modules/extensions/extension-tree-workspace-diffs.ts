import type { CommandExecutionResult } from "@pstdio/sdk/api";
import { settleReadBatch } from "@pstdio/workbench";
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

const collectWorkspaceIds = (value: unknown, ids: Set<string>) => {
  if (!isRecord(value)) return;
  for (const resource of [value.resource, isRecord(value.target) ? value.target.resource : undefined]) {
    if (isRecord(resource) && resource.type === "workspace" && typeof resource.id === "string") ids.add(resource.id);
  }
  for (const children of [value.nodes, value.children]) {
    if (Array.isArray(children)) for (const child of children) collectWorkspaceIds(child, ids);
  }
};

const withResourceDiffMetadata = (value: unknown, summaries: Map<string, DashboardWorkspaceDiffSummary | null>) => {
  if (!isRecord(value) || value.type !== "workspace" || typeof value.id !== "string") return value;

  const summary = summaries.get(value.id);
  if (!summary) return value;

  return {
    ...value,
    metadata: {
      ...(isRecord(value.metadata) ? value.metadata : {}),
      ...diffMetadata(summary),
    },
  };
};

const withNodeDiffMetadata = (
  value: unknown,
  summaries: Map<string, DashboardWorkspaceDiffSummary | null>,
): unknown => {
  if (!isRecord(value)) return value;

  const next: Record<string, unknown> = { ...value };
  if (isRecord(next.target)) {
    next.target = {
      ...next.target,
      resource: withResourceDiffMetadata(next.target.resource, summaries),
    };
  }
  next.resource = withResourceDiffMetadata(next.resource, summaries);
  if (Array.isArray(next.children)) {
    next.children = next.children.map((child) => withNodeDiffMetadata(child, summaries));
  }

  return next;
};

const withSectionDiffMetadata = (value: unknown, summaries: Map<string, DashboardWorkspaceDiffSummary | null>) => {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return value;

  return {
    ...value,
    nodes: value.nodes.map((node) => withNodeDiffMetadata(node, summaries)),
  };
};

export const withWorkspaceDiffMetadata = async (
  response: CommandExecutionResult,
  resolveSummary: ResolveWorkspaceDiffSummary = resolveDashboardWorkspaceDiffSummary,
  signal?: AbortSignal,
): Promise<CommandExecutionResult> => {
  if (!response.outcome.ok || !Array.isArray(response.outcome.value)) return response;

  const ids = new Set<string>();
  for (const section of response.outcome.value) collectWorkspaceIds(section, ids);
  const workspaceIds = [...ids];
  const summaries = new Map<string, DashboardWorkspaceDiffSummary | null>();
  // Match the normal workspace list's four-read bound, without serializing unrelated trees.
  for (let index = 0; index < workspaceIds.length; index += 4) {
    const loaded = await settleReadBatch(
      workspaceIds.slice(index, index + 4).map((id) => async (signal) => {
        try {
          return [id, await resolveSummary(id, signal)] as const;
        } catch {
          signal.throwIfAborted();
          return [id, null] as const;
        }
      }),
      signal,
    );
    for (const [id, summary] of loaded) summaries.set(id, summary);
  }
  signal?.throwIfAborted();
  const sections = response.outcome.value.map((section) => withSectionDiffMetadata(section, summaries));
  return {
    ...response,
    outcome: {
      ...response.outcome,
      value: sections,
    },
  };
};
