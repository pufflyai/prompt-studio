interface ResolveTicketSidebarActiveNodeIdInput {
  selectedFileId: string;
  selectedWorkspaceId: string | null | undefined;
  activeSessionId: string | null;
  workspaceSessionIds: Set<string>;
}

export const resolveTicketSidebarActiveNodeId = (input: ResolveTicketSidebarActiveNodeIdInput) => {
  const { selectedFileId, selectedWorkspaceId, activeSessionId, workspaceSessionIds } = input;

  if (activeSessionId && workspaceSessionIds.has(activeSessionId)) {
    return `session:${activeSessionId}`;
  }

  if (selectedWorkspaceId) {
    return `workspace:${selectedWorkspaceId}`;
  }

  return `file:${selectedFileId}`;
};
