import { settleReadBatch } from "@pstdio/workbench";
import { getApiClient } from "@/lib/api";
import { getRuntimeCollections, type RuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";
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

const runtimeState = createRuntimeState(
  () => ({
    summaries: new Map<string, DashboardWorkspaceDiffSummary>(),
    listeners: new Set<(workspaceId: string) => void>(),
  }),
  (state) => {
    state.summaries.clear();
    state.listeners.clear();
  },
);

export const formatDashboardWorkspaceDiffOverview = (summary: DashboardWorkspaceDiffSummary) =>
  `+${summary.additions} -${summary.deletions}`;

const toDashboardWorkspaceDiffSummary = (response: DashboardWorkspaceDiffSummaryResponse) => ({
  workspaceId: response.workspace_id,
  additions: response.additions,
  deletions: response.deletions,
  fileCount: response.file_count,
});

const fetchDashboardWorkspaceDiffSummary = async (
  workspaceId: string,
  owner: RuntimeCollections,
  signal?: AbortSignal,
) => {
  const response = await getApiClient(owner.connection).workspaces.diffSummary(workspaceId, "fork_point", signal);

  return response ? toDashboardWorkspaceDiffSummary(response) : null;
};

const writeDashboardWorkspaceDiffSummary = (
  summary: DashboardWorkspaceDiffSummary | null,
  owner: RuntimeCollections,
) => {
  if (!summary || owner.isDisposed()) return null;
  const state = runtimeState(owner);
  state.summaries.set(summary.workspaceId, summary);
  for (const listener of state.listeners) listener(summary.workspaceId);
  return summary;
};

export const getDashboardWorkspaceDiffSummary = (workspaceId: string, owner = getRuntimeCollections()) =>
  runtimeState(owner).summaries.get(workspaceId);

export const getDashboardWorkspaceDiffSummaries = (workspaceIds: string[], owner = getRuntimeCollections()) => {
  const summaries = new Map<string, DashboardWorkspaceDiffSummary>();

  for (const workspaceId of workspaceIds) {
    const summary = runtimeState(owner).summaries.get(workspaceId);
    if (summary) summaries.set(workspaceId, summary);
  }

  return summaries;
};

export const resolveDashboardWorkspaceDiffSummary = async (
  workspaceId: string,
  signal?: AbortSignal,
  owner = getRuntimeCollections(),
) => {
  signal?.throwIfAborted();
  const workspace = owner.getCollection("workspaces").state.get(workspaceId);
  if (!workspace || workspaceState(workspace) !== "ready") return null;
  const capabilities = workspace.provider_capabilities_json as { diff?: boolean } | undefined;
  if (capabilities?.diff !== true) return null;
  const cached = runtimeState(owner).summaries.get(workspaceId);
  if (cached) return cached;

  return writeDashboardWorkspaceDiffSummary(
    await fetchDashboardWorkspaceDiffSummary(workspaceId, owner, signal),
    owner,
  );
};

export const requestDashboardWorkspaceDiffSummaries = async (
  workspaceIds: string[],
  signal?: AbortSignal,
  owner = getRuntimeCollections(),
) => {
  const summaries = new Map<string, DashboardWorkspaceDiffSummary>();
  const ids = [...new Set(workspaceIds)];
  for (let index = 0; index < ids.length; index += 4) {
    const loaded = await settleReadBatch(
      ids.slice(index, index + 4).map((id) => async (signal) => {
        try {
          const summary = await resolveDashboardWorkspaceDiffSummary(id, signal, owner);
          return [id, summary] as const;
        } catch (error) {
          signal.throwIfAborted();
          if (error instanceof Error && error.name === "AbortError") throw error;
          return [id, null] as const;
        }
      }),
      signal,
    );
    for (const [id, summary] of loaded) if (summary) summaries.set(id, summary);
  }

  return summaries;
};

export const subscribeDashboardWorkspaceDiffSummaries = (
  listener: (workspaceId: string) => void,
  owner = getRuntimeCollections(),
) => {
  const workspaceDiffSummaryListeners = runtimeState(owner).listeners;
  workspaceDiffSummaryListeners.add(listener);
  return () => {
    workspaceDiffSummaryListeners.delete(listener);
  };
};
