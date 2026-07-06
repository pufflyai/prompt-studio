interface WorkspaceForkPointDiffInput {
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export const resolveWorkspaceForkPointDiffWorkspaceId = (input: WorkspaceForkPointDiffInput) => {
  if (input.metadata?.workspaceType === "current_branch") return undefined;

  const metadataWorkspaceId = input.metadata?.workspaceId;
  if (typeof metadataWorkspaceId === "string") return metadataWorkspaceId;

  return input.resourceId;
};
