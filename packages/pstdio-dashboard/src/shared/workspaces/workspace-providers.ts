import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import { queryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const fetchWorkspaceProviders = (projectId: string) =>
  apiRequest<WorkspaceProviderDescriptor[]>(`/v1/projects/${projectId}/workspace-providers`);

export const workspaceProvidersQueryOptions = (projectId: string | undefined) =>
  queryOptions({
    queryKey: ["workspace-providers", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return fetchWorkspaceProviders(projectId);
    },
    enabled: Boolean(projectId),
    staleTime: 0,
    retry: false,
  });
