import { isBinaryDiffPath, isGeneratedDiffPath, LARGE_DIFF_LINE_THRESHOLD } from "@pstdio/ui/diff";
import type { WorkspaceDiffMode, WorkspaceDiffSummaryFile } from "../data/workspace-queries";

interface WorkspaceDiffInput {
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export const resolveWorkspaceDiffRequest = (input: WorkspaceDiffInput) => {
  const metadataWorkspaceId = input.metadata?.workspaceId;
  const workspaceId = typeof metadataWorkspaceId === "string" ? metadataWorkspaceId : input.resourceId;
  if (!workspaceId) return undefined;

  const mode: WorkspaceDiffMode = input.metadata?.workspaceType === "current_branch" ? "current" : "fork_point";
  return { workspaceId, mode };
};

export const resolveDefaultWorkspaceDiffPath = (files: WorkspaceDiffSummaryFile[]) => {
  const loadable = files.find((file) => {
    const path = file.newPath ?? file.oldPath ?? file.filePath;
    const lineCount = (file.additions ?? 0) + (file.deletions ?? 0);
    return lineCount <= LARGE_DIFF_LINE_THRESHOLD && !isGeneratedDiffPath(path) && !isBinaryDiffPath(path);
  });
  const selected = loadable ?? files[0];
  return selected ? (selected.newPath ?? selected.oldPath ?? selected.filePath) : undefined;
};
