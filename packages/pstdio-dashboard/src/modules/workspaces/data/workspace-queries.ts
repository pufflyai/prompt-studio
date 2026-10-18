import type { ListWorkspaceFilesInput } from "@pstdio/sdk/api";
import type { Diff } from "@pstdio/ui/diff";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/lib/api";

export interface WorkspaceDiffSummaryFile extends Diff {
  filePath: string;
}

export type WorkspaceDiffMode = "current" | "fork_point";

export const workspaceDiffFilePath = (diff: Pick<WorkspaceDiffSummaryFile, "filePath" | "newPath" | "oldPath">) =>
  diff.newPath ?? diff.oldPath ?? diff.filePath;

export const workspaceFilesQueryKey = (workspaceId: string, input: ListWorkspaceFilesInput) =>
  ["workspace-files", workspaceId, "list", input] as const;

export const workspaceDiffFilesQueryKey = (workspaceId: string, mode: WorkspaceDiffMode) =>
  ["workspace-diffs", workspaceId, "files", mode] as const;

export const workspaceDiffFileQueryKey = (workspaceId: string, mode: WorkspaceDiffMode, path: string) =>
  ["workspace-diffs", workspaceId, "file", mode, path] as const;

export const workspaceDiffFilesQueryOptions = (workspaceId: string, mode: WorkspaceDiffMode) => {
  const client = getApiClient().workspaces;
  return queryOptions({
    queryKey: workspaceDiffFilesQueryKey(workspaceId, mode),
    queryFn: () => client.diffFiles(workspaceId, mode),
  });
};

export const workspaceDiffFileQueryOptions = (workspaceId: string, mode: WorkspaceDiffMode, path: string) => {
  const client = getApiClient().workspaces;
  return queryOptions({
    queryKey: workspaceDiffFileQueryKey(workspaceId, mode, path),
    queryFn: () => client.diffFile(workspaceId, mode, path),
  });
};

export const invalidateWorkspaceFileData = async (queryClient: QueryClient, workspaceId: string) => {
  await queryClient.cancelQueries({ queryKey: ["workspace-diffs", workspaceId] });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["workspace-files", workspaceId, "list"] }),
    queryClient.invalidateQueries({ queryKey: ["workspace-diffs", workspaceId] }),
    queryClient.invalidateQueries({ queryKey: ["workspace-diff-summary", workspaceId] }),
  ]);
};
