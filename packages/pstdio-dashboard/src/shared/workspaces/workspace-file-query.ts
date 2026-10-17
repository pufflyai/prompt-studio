import { queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export const workspaceFileQueryKey = (workspaceId: string, path: string) =>
  ["workspace-files", workspaceId, "file", path] as const;

export const workspaceFileQueryOptions = (workspaceId: string, path: string) => {
  const client = getApiClient();
  return queryOptions({
    queryKey: workspaceFileQueryKey(workspaceId, path),
    queryFn: ({ signal }) => client.workspaces.readFile(workspaceId, path, { signal }),
  });
};
