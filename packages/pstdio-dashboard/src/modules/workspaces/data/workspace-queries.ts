import type { ListWorkspaceFilesInput } from "@pstdio/sdk/api";
import type { Diff } from "@pstdio/ui/diff";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { apiRequest, getApiClient } from "@/lib/api";

export interface WorkspaceDiffSummaryFile extends Diff {
  filePath: string;
}

export interface WorkspaceDiffFilesResponse {
  workspace_id: string;
  files: WorkspaceDiffSummaryFile[];
}

export const workspaceFileQueryKey = (workspaceId: string, path: string) =>
  ["workspace-files", workspaceId, "file", path] as const;

export const workspaceFilesQueryKey = (workspaceId: string, input: ListWorkspaceFilesInput) =>
  ["workspace-files", workspaceId, "list", input] as const;

export const workspaceDiffFilesQueryKey = (workspaceId: string) =>
  ["workspace-diffs", workspaceId, "files", "fork_point"] as const;

export const workspaceDiffFileQueryKey = (workspaceId: string, path: string) =>
  ["workspace-diffs", workspaceId, "file", "fork_point", path] as const;

export const workspaceFilesQueryOptions = (workspaceId: string, input: ListWorkspaceFilesInput) =>
  queryOptions({
    queryKey: workspaceFilesQueryKey(workspaceId, input),
    queryFn: () => getApiClient().workspaces.listFiles(workspaceId, input),
  });

export const workspaceFileQueryOptions = (workspaceId: string, path: string) =>
  queryOptions({
    queryKey: workspaceFileQueryKey(workspaceId, path),
    queryFn: () => getApiClient().workspaces.readFile(workspaceId, path),
  });

export const workspaceDiffFilesQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: workspaceDiffFilesQueryKey(workspaceId),
    queryFn: () =>
      apiRequest<WorkspaceDiffFilesResponse | null>(`/v1/workspaces/${workspaceId}/diff-files?mode=fork_point`, {
        allowNotFound: true,
      }),
  });

export const workspaceDiffFileQueryOptions = (workspaceId: string, path: string) =>
  queryOptions({
    queryKey: workspaceDiffFileQueryKey(workspaceId, path),
    queryFn: () =>
      apiRequest<WorkspaceDiffSummaryFile | null>(
        `/v1/workspaces/${workspaceId}/diff-file?mode=fork_point&path=${encodeURIComponent(path)}`,
        { allowNotFound: true },
      ),
  });

export const invalidateWorkspaceFileData = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["workspace-files", workspaceId, "list"] }),
    queryClient.invalidateQueries({ queryKey: ["workspace-diffs", workspaceId] }),
    queryClient.invalidateQueries({ queryKey: ["workspace-diff-summary", workspaceId] }),
  ]);
};
