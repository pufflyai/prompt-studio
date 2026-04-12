interface ResolveTicketSidebarActiveNodeIdsInput {
  selectedFileId: string;
  selectedWorkspaceId: string | null | undefined;
  activeSessionId: string | null;
  workspaceSessionIds: Set<string>;
}

export const resolveTicketSidebarActiveNodeIds = (input: ResolveTicketSidebarActiveNodeIdsInput) => {
  const { selectedFileId, selectedWorkspaceId, activeSessionId, workspaceSessionIds } = input;

  if (selectedWorkspaceId) {
    const ids = [`workspace:${selectedWorkspaceId}`];
    if (activeSessionId && workspaceSessionIds.has(activeSessionId)) {
      ids.push(`session:${activeSessionId}`);
    }
    return ids;
  }

  return [`file:${selectedFileId}`];
};
