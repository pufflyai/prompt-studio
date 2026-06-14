import { apiRequest } from "@/lib/api";

interface DashboardWorkspaceDiffSummaryResponse {
  workspace_id: string;
  additions: number;
  deletions: number;
  file_count: number;
}

export interface DashboardWorkspaceDiffSummary {
  workspaceId: string;
  additions: number;
  deletions: number;
  fileCount: number;
}

const workspaceDiffSummariesById = new Map<string, DashboardWorkspaceDiffSummary>();
const pendingWorkspaceDiffSummaryLoads = new Map<string, Promise<DashboardWorkspaceDiffSummary | null>>();
const workspaceDiffSummaryListeners = new Set<() => void>();

export const formatDashboardWorkspaceDiffOverview = (summary: DashboardWorkspaceDiffSummary) =>
  `+${summary.additions} -${summary.deletions}`;

const toDashboardWorkspaceDiffSummary = (response: DashboardWorkspaceDiffSummaryResponse) => ({
  workspaceId: response.workspace_id,
  additions: response.additions,
  deletions: response.deletions,
  fileCount: response.file_count,
});

const notifyWorkspaceDiffSummaryListeners = () => {
  for (const listener of workspaceDiffSummaryListeners) listener();
};

const fetchDashboardWorkspaceDiffSummary = async (workspaceId: string) => {
  const response = await apiRequest<DashboardWorkspaceDiffSummaryResponse | null>(
    `/v1/workspaces/${workspaceId}/diff-summary?mode=fork_point`,
    { allowNotFound: true },
  );

  return response ? toDashboardWorkspaceDiffSummary(response) : null;
};

const writeDashboardWorkspaceDiffSummary = (summary: DashboardWorkspaceDiffSummary | null) => {
  if (!summary) return summary;
  workspaceDiffSummariesById.set(summary.workspaceId, summary);
  notifyWorkspaceDiffSummaryListeners();
  return summary;
};

export const getDashboardWorkspaceDiffSummary = (workspaceId: string) => workspaceDiffSummariesById.get(workspaceId);

export const getDashboardWorkspaceDiffSummaries = (workspaceIds: string[]) => {
  const summaries = new Map<string, DashboardWorkspaceDiffSummary>();

  for (const workspaceId of workspaceIds) {
    const summary = workspaceDiffSummariesById.get(workspaceId);
    if (summary) summaries.set(workspaceId, summary);
  }

  return summaries;
};

export const resolveDashboardWorkspaceDiffSummary = async (workspaceId: string) => {
  const cached = workspaceDiffSummariesById.get(workspaceId);
  if (cached) return cached;

  const pending = pendingWorkspaceDiffSummaryLoads.get(workspaceId);
  if (pending) return pending;

  const next = fetchDashboardWorkspaceDiffSummary(workspaceId)
    .then(writeDashboardWorkspaceDiffSummary)
    .finally(() => {
      pendingWorkspaceDiffSummaryLoads.delete(workspaceId);
    });

  pendingWorkspaceDiffSummaryLoads.set(workspaceId, next);
  return next;
};

export const requestDashboardWorkspaceDiffSummaries = async (workspaceIds: string[]) => {
  const summaries = new Map<string, DashboardWorkspaceDiffSummary>();

  const loaded = await Promise.all(
    [...new Set(workspaceIds)].map(async (workspaceId) => {
      const summary = await resolveDashboardWorkspaceDiffSummary(workspaceId).catch(() => null);
      return [workspaceId, summary] as const;
    }),
  );

  for (const [workspaceId, summary] of loaded) {
    if (summary) summaries.set(workspaceId, summary);
  }

  return summaries;
};

export const subscribeDashboardWorkspaceDiffSummaries = (listener: () => void) => {
  workspaceDiffSummaryListeners.add(listener);
  return () => {
    workspaceDiffSummaryListeners.delete(listener);
  };
};
