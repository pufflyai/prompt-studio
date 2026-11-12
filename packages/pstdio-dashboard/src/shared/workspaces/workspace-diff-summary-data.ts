import type { ScopedQuery } from "@pstdio/sdk/extensions";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections, type RuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { createWorkspaceDiffAdmission } from "./workspace-diff-admission";
import { waitForWorkspaceDiffSummary } from "./workspace-diff-query-wait";
import { settleWorkspaceDiffReads } from "./workspace-diff-reads";
import { createWorkspaceDiffSource } from "./workspace-diff-source";
import { workspaceState } from "./workspace-state";

export interface DashboardWorkspaceDiffSummary {
  workspaceId: string;
  additions: number;
  deletions: number;
  fileCount: number;
}

const queryId = "workspaces.diff-summary";
const sourceKeyFor = (projectId: string | undefined, workspaceId: string) => JSON.stringify([projectId, workspaceId]);
const workspaceDiffLocation = (row: Record<string, unknown>) =>
  JSON.stringify([row.execution_kind, row.provider_id, row.root_path, row.provider_ref_json, row.branch]);
const runtimeState = createRuntimeState(
  (owner) => {
    const queries = new Map<string, ScopedQuery<DashboardWorkspaceDiffSummary | null>>();
    let pruning = false;
    const stopRetirement = getDashboardScopedQueries(owner).subscribeRetirement(() => {
      if (pruning) return;
      pruning = true;
      // Retirement can occur during row creation; prune once after the current render batch.
      queueMicrotask(() => {
        pruning = false;
        for (const [id, query] of queries) if (query.isDisposed()) queries.delete(id);
      });
    });
    return {
      queries,
      stopRetirement,
      sources: new Map<string, ReturnType<typeof createWorkspaceDiffSource> & { location: string }>(),
      admit: createWorkspaceDiffAdmission(),
    };
  },
  (state) => {
    state.stopRetirement();
    for (const source of state.sources.values()) source.close();
    state.sources.clear();
    state.queries.clear();
  },
);
const readyWorkspace = (workspaceId: string, owner: RuntimeCollections) => {
  if (owner.isDisposed()) return undefined;
  const workspace = owner.getCollection("workspaces").get(workspaceId);
  const capabilities = workspace?.provider_capabilities_json as { diff?: boolean } | undefined;
  return workspace && workspaceState(workspace) === "ready" && capabilities?.diff === true ? workspace : undefined;
};

export const getDashboardWorkspaceDiffQuery = (
  workspaceId: string,
  owner = getRuntimeCollections(),
  expectedProjectId?: string,
) => {
  if (owner.isDisposed()) throw new Error("Runtime is disposed");
  const state = runtimeState(owner);
  const workspace = owner.getCollection("workspaces").get(workspaceId);
  const projectId = expectedProjectId ?? (typeof workspace?.project_id === "string" ? workspace.project_id : undefined);
  const sourceKey = sourceKeyFor(projectId, workspaceId);
  const cached = state.queries.get(sourceKey);
  if (cached && !cached.isDisposed()) return cached;
  const query = getDashboardScopedQueries(owner)
    .forScope({ projectId })
    .query({
      id: queryId,
      resourceKey: workspaceId,
      read: async (signal) => {
        const row = readyWorkspace(workspaceId, owner);
        if (!row || row.project_id !== projectId) return null;
        const location = workspaceDiffLocation(row);
        const currentLocation = () => {
          const current = readyWorkspace(workspaceId, owner);
          return current && current.project_id === projectId && workspaceDiffLocation(current) === location;
        };
        await state.sources.get(sourceKey)?.ready;
        signal.throwIfAborted();
        // Watch setup and finite admission can both outlive a scope or capability change.
        const response = await state.admit(signal, async () =>
          currentLocation()
            ? getRuntimeApiClient(owner).workspaces.diffSummary(workspaceId, "fork_point", signal)
            : null,
        );
        signal.throwIfAborted();
        if (!currentLocation()) return null;
        return response
          ? {
              workspaceId: response.workspace_id,
              additions: response.additions,
              deletions: response.deletions,
              fileCount: response.file_count,
            }
          : null;
      },
      subscribe: (invalidate) => {
        const readIdentity = () => {
          const row = readyWorkspace(workspaceId, owner);
          if (!row || row.project_id !== projectId) return undefined;
          // Only local workspaces have a file stream; others still need revision hints.
          const revision = row.execution_kind === "local" ? undefined : row.updated_at;
          return JSON.stringify([workspaceDiffLocation(row), revision]);
        };
        let observedIdentity = readIdentity();
        const syncSource = () => {
          const row = readyWorkspace(workspaceId, owner);
          const current = state.sources.get(sourceKey);
          if (
            !row ||
            row.execution_kind !== "local" ||
            typeof row.project_id !== "string" ||
            row.project_id !== projectId
          ) {
            current?.close();
            state.sources.delete(sourceKey);
          } else {
            const location = workspaceDiffLocation(row);
            if (current?.location === location) return;
            current?.close();
            state.sources.set(sourceKey, {
              location,
              ...createWorkspaceDiffSource(owner, workspaceId, row.project_id, invalidate),
            });
          }
        };
        const stop = owner.subscribeCollections((change) => {
          if (change && (change.table !== "workspaces" || !change.changes.some((row) => row.key === workspaceId)))
            return;
          const identity = readIdentity();
          if (identity === observedIdentity) return;
          observedIdentity = identity;
          syncSource();
          invalidate();
        });
        syncSource();
        return () => {
          stop();
          state.sources.get(sourceKey)?.close();
          state.sources.delete(sourceKey);
        };
      },
    });
  state.queries.set(sourceKey, query);
  return query;
};

export const formatDashboardWorkspaceDiffOverview = (summary: DashboardWorkspaceDiffSummary) =>
  `+${summary.additions} -${summary.deletions}`;

export const getDashboardWorkspaceDiffSummary = (workspaceId: string, owner = getRuntimeCollections()) => {
  if (owner.isDisposed()) return undefined;
  const projectId = owner.getCollection("workspaces").get(workspaceId)?.project_id;
  const query = runtimeState(owner).queries.get(
    sourceKeyFor(typeof projectId === "string" ? projectId : undefined, workspaceId),
  );
  return !query?.isDisposed() ? (query?.getSnapshot().data ?? undefined) : undefined;
};

export const getDashboardWorkspaceDiffSummaries = (workspaceIds: string[], owner = getRuntimeCollections()) => {
  const summaries = new Map<string, DashboardWorkspaceDiffSummary>();
  for (const id of workspaceIds) {
    const summary = getDashboardWorkspaceDiffSummary(id, owner);
    if (summary) summaries.set(id, summary);
  }
  return summaries;
};

export const resolveDashboardWorkspaceDiffSummary = async (
  workspaceId: string,
  signal?: AbortSignal,
  owner = getRuntimeCollections(),
) => {
  signal?.throwIfAborted();
  if (!readyWorkspace(workspaceId, owner)) return null;
  const query = getDashboardWorkspaceDiffQuery(workspaceId, owner);
  return waitForWorkspaceDiffSummary(query, signal);
};

export const requestDashboardWorkspaceDiffSummaries = async (
  workspaceIds: string[],
  signal?: AbortSignal,
  owner = getRuntimeCollections(),
) => {
  const summaries = new Map<string, DashboardWorkspaceDiffSummary>();
  const ids = [...new Set(workspaceIds)];
  const loaded = await settleWorkspaceDiffReads(
    ids.map((id) => async (signal) => {
      try {
        return [id, await resolveDashboardWorkspaceDiffSummary(id, signal, owner)] as const;
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof Error && error.name === "AbortError") throw error;
        return [id, null] as const;
      }
    }),
    signal,
  );
  for (const [id, summary] of loaded) if (summary) summaries.set(id, summary);
  return summaries;
};

export const subscribeDashboardWorkspaceDiffSummaries = (
  listener: (workspaceId: string) => void,
  owner = getRuntimeCollections(),
) =>
  getDashboardQueryClient(owner)
    .getQueryCache()
    .subscribe((event) => {
      const key = event.query.queryKey;
      if (
        key[0] === "pstdio" &&
        key[6] === queryId &&
        typeof key[7] === "string" &&
        (event.type === "removed" || (event.type === "updated" && event.action.type === "success"))
      )
        listener(key[7]);
    });
