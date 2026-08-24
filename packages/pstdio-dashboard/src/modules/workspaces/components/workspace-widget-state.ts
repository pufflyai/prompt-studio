import type { WorkspaceDiffMode } from "../data/workspace-queries";

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
