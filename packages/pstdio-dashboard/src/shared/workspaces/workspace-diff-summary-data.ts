import { settleReadBatch } from "@pstdio/workbench";
import { apiRequest } from "@/lib/api";
import { getCollection } from "@/lib/sync/collections";
import { workspaceState } from "./workspace-state";

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

const fetchDashboardWorkspaceDiffSummary = async (workspaceId: string, signal?: AbortSignal) => {
  const response = await apiRequest<DashboardWorkspaceDiffSummaryResponse | null>(
    `/v1/workspaces/${workspaceId}/diff-summary?mode=fork_point`,
    { allowNotFound: true, signal },
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

export const resolveDashboardWorkspaceDiffSummary = async (workspaceId: string, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const workspace = getCollection("workspaces").state.get(workspaceId);
  if (!workspace || workspaceState(workspace) !== "ready") return null;
  const capabilities = workspace.provider_capabilities_json as { diff?: boolean } | undefined;
  if (capabilities?.diff === false) return null;
  const cached = workspaceDiffSummariesById.get(workspaceId);
  if (cached) return cached;

  return writeDashboardWorkspaceDiffSummary(await fetchDashboardWorkspaceDiffSummary(workspaceId, signal));
};

export const requestDashboardWorkspaceDiffSummaries = async (workspaceIds: string[], signal?: AbortSignal) => {
  const summaries = new Map<string, DashboardWorkspaceDiffSummary>();
  const ids = [...new Set(workspaceIds)];
  for (let index = 0; index < ids.length; index += 4) {
    const loaded = await settleReadBatch(
      ids.slice(index, index + 4).map((id) => async (signal) => {
        const summary = await resolveDashboardWorkspaceDiffSummary(id, signal);
        return [id, summary] as const;
      }),
      signal,
    );
    for (const [id, summary] of loaded) if (summary) summaries.set(id, summary);
  }

  return summaries;
};

export const subscribeDashboardWorkspaceDiffSummaries = (listener: () => void) => {
  workspaceDiffSummaryListeners.add(listener);
  return () => {
    workspaceDiffSummaryListeners.delete(listener);
  };
};
