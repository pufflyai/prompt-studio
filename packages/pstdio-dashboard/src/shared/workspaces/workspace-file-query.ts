import type { ListWorkspaceFilesInput } from "@pstdio/sdk/api";
import { queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export const workspaceFileQueryKey = (workspaceId: string, path: string) =>
  ["workspace-files", workspaceId, "file", path] as const;

export const workspaceFilesQueryKey = (workspaceId: string, input: ListWorkspaceFilesInput) =>
  ["workspace-files", workspaceId, "list", input] as const;

export const workspaceFileQueryOptions = (workspaceId: string, path: string) => {
  const client = getApiClient();
  return queryOptions({
    queryKey: workspaceFileQueryKey(workspaceId, path),
    queryFn: ({ signal }) => client.workspaces.readFile(workspaceId, path, { signal }),
  });
};

export const workspaceFolderQueryOptions = (workspaceId: string, path: string) => {
  const client = getApiClient();
  const input = { path, limit: 500 };
  return queryOptions({
    queryKey: workspaceFilesQueryKey(workspaceId, input),
    queryFn: ({ signal }) => client.workspaces.listFiles(workspaceId, input, { signal }),
  });
};
