import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export const workspaceProvidersQueryKey = (projectId: string | undefined) =>
  ["workspace-providers", projectId] as const;

export const invalidateWorkspaceProviders = async (client: QueryClient, projectId: string | undefined) => {
  const queryKey = workspaceProvidersQueryKey(projectId);
  // Cancel even the first pending read: it predates the catalog change and has no data to invalidate yet.
  await client.cancelQueries({ queryKey });
  await client.invalidateQueries({ queryKey });
};

export const workspaceProvidersQueryOptions = (projectId: string | undefined) => {
  const client = getApiClient();
  return queryOptions({
    queryKey: workspaceProvidersQueryKey(projectId),
    queryFn: async ({ signal }) => {
      if (!projectId) return [];
      return client.workspaces.listProviders(projectId, { signal });
    },
    enabled: Boolean(projectId),
    staleTime: 0,
    retry: false,
  });
};
