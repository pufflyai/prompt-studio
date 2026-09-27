import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const fetchWorkspaceProviders = (projectId: string, signal?: AbortSignal) =>
  apiRequest<WorkspaceProviderDescriptor[]>(`/v1/projects/${projectId}/workspace-providers`, { signal });

export const workspaceProvidersQueryKey = (projectId: string | undefined) =>
  ["workspace-providers", projectId] as const;

export const invalidateWorkspaceProviders = async (client: QueryClient, projectId: string | undefined) => {
  const queryKey = workspaceProvidersQueryKey(projectId);
  // Cancel even the first pending read: it predates the catalog change and has no data to invalidate yet.
  await client.cancelQueries({ queryKey });
  await client.invalidateQueries({ queryKey });
};

export const workspaceProvidersQueryOptions = (projectId: string | undefined) =>
  queryOptions({
    queryKey: workspaceProvidersQueryKey(projectId),
    queryFn: async ({ signal }) => {
      if (!projectId) return [];
      return fetchWorkspaceProviders(projectId, signal);
    },
    enabled: Boolean(projectId),
    staleTime: 0,
    retry: false,
  });
