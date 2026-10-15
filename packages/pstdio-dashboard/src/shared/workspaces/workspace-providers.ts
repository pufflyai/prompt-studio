import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { apiRequest, createApiRequest } from "@/lib/api";

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

export const workspaceProvidersQueryOptions = (projectId: string | undefined) => {
  const request = createApiRequest();
  return queryOptions({
    queryKey: workspaceProvidersQueryKey(projectId),
    queryFn: async ({ signal }) => {
      if (!projectId) return [];
      return request<WorkspaceProviderDescriptor[]>(`/v1/projects/${projectId}/workspace-providers`, { signal });
    },
    enabled: Boolean(projectId),
    staleTime: 0,
    retry: false,
  });
};
