import type { ScopedQuery } from "@pstdio/sdk/extensions";
import { settleReadBatch } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections, type RuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { createWorkspaceDiffAdmission } from "./workspace-diff-admission";
import { createWorkspaceDiffSource } from "./workspace-diff-source";
import { workspaceState } from "./workspace-state";

export interface DashboardWorkspaceDiffSummary {
  workspaceId: string;
  additions: number;
  deletions: number;
  fileCount: number;
}

const queryId = "workspaces.diff-summary";
const runtimeState = createRuntimeState(
  () => ({
    queries: new Map<string, ScopedQuery<DashboardWorkspaceDiffSummary | null>>(),
    sources: new Map<string, ReturnType<typeof createWorkspaceDiffSource> & { location: string }>(),
    admit: createWorkspaceDiffAdmission(),
  }),
  (state) => {
    for (const source of state.sources.values()) source.close();
    state.sources.clear();
    state.queries.clear();
  },
);
const readyWorkspace = (workspaceId: string, owner: RuntimeCollections) => {
  const workspace = owner.getCollection("workspaces").get(workspaceId);
  const capabilities = workspace?.provider_capabilities_json as { diff?: boolean } | undefined;
  return workspace && workspaceState(workspace) === "ready" && capabilities?.diff === true ? workspace : undefined;
};

export const getDashboardWorkspaceDiffQuery = (workspaceId: string, owner = getRuntimeCollections()) => {
  const state = runtimeState(owner);
  for (const [id, query] of state.queries) if (query.isDisposed()) state.queries.delete(id);
  const workspace = owner.getCollection("workspaces").get(workspaceId);
  const projectId = typeof workspace?.project_id === "string" ? workspace.project_id : undefined;
  const sourceKey = JSON.stringify([projectId, workspaceId]);
  const query = getDashboardScopedQueries(owner)
    .forScope({ projectId })
    .query({
      id: queryId,
      resourceKey: workspaceId,
      read: async (signal) => {
        const row = readyWorkspace(workspaceId, owner);
        if (!row || row.project_id !== workspace?.project_id) return null;
        await state.sources.get(sourceKey)?.ready;
        signal.throwIfAborted();
        const response = await state.admit(signal, () =>
          getRuntimeApiClient(owner).workspaces.diffSummary(workspaceId, "fork_point", signal),
        );
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
            const location = JSON.stringify([row.root_path, row.provider_ref_json]);
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
  state.queries.set(workspaceId, query);
  return query;
};

export const formatDashboardWorkspaceDiffOverview = (summary: DashboardWorkspaceDiffSummary) =>
  `+${summary.additions} -${summary.deletions}`;

export const getDashboardWorkspaceDiffSummary = (workspaceId: string, owner = getRuntimeCollections()) => {
  if (owner.isDisposed()) return undefined;
  const query = runtimeState(owner).queries.get(workspaceId);
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
  const stop = query.subscribe(() => {});
  const aborted = Promise.withResolvers<never>();
  const onAbort = () => aborted.reject(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([query.read(), aborted.promise]);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    stop();
  }
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
  }
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
