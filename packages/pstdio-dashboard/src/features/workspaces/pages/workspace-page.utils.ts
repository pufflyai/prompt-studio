export const resolvePendingWorkspaceSessionWorkspaceId = (
  pendingWorkspaceSessionWorkspaceId: string | null,
  selectedWorkspaceId: string | null,
) => {
  if (!pendingWorkspaceSessionWorkspaceId) {
    return null;
  }

  return pendingWorkspaceSessionWorkspaceId === selectedWorkspaceId ? pendingWorkspaceSessionWorkspaceId : null;
};
