interface SessionWorkspaceLike {
  id: string;
  branch: string | null;
  workspaceShorthand: string | null;
}

interface WorkspaceDiffSummaryLike {
  workspace_id: string;
  file_count: number;
  additions: number;
  deletions: number;
}

interface BuildSessionWorkspaceHubModelInput {
  projectId: string | undefined;
  workspace: SessionWorkspaceLike | null;
  diffSummary: WorkspaceDiffSummaryLike | undefined;
}

interface BuildSessionWorkspaceHubPanelModelInput extends BuildSessionWorkspaceHubModelInput {
  showWorkspaceHub: boolean;
  isWorkspaceInitializing: boolean;
  setupError: string | null;
  statusLabel: string;
  changesLabel: (count: number) => string;
}

export const getTicketShorthandFromWorkspaceShorthand = (workspaceShorthand: string | null | undefined) => {
  const [ticketShorthand, attemptSuffix] = workspaceShorthand?.trim().split("_") ?? [];
  if (!ticketShorthand || !attemptSuffix) return null;
  return ticketShorthand;
};

export const buildSessionWorkspaceHubModel = (input: BuildSessionWorkspaceHubModelInput) => {
  const { projectId, workspace, diffSummary } = input;
  if (!projectId || !workspace?.workspaceShorthand || !diffSummary) return null;

  const ticketShorthand = getTicketShorthandFromWorkspaceShorthand(workspace.workspaceShorthand);
  if (!ticketShorthand) return null;

  return {
    href: `/projects/${projectId}/tickets/${ticketShorthand}/workspaces/${workspace.workspaceShorthand}`,
    fileCount: diffSummary.file_count,
    additions: diffSummary.additions,
    deletions: diffSummary.deletions,
  };
};

export const buildSessionWorkspaceHubPanelModel = (input: BuildSessionWorkspaceHubPanelModelInput) => {
  const { showWorkspaceHub, isWorkspaceInitializing, setupError, statusLabel, changesLabel } = input;
  if (!showWorkspaceHub) return null;

  if (setupError) {
    return {
      status: "error" as const,
      statusLabel: setupError,
      changesLabel: "",
      additions: 0,
      deletions: 0,
    };
  }

  if (isWorkspaceInitializing) {
    return {
      status: "loading" as const,
      statusLabel,
      changesLabel: "",
      additions: 0,
      deletions: 0,
    };
  }

  const workspaceHub = buildSessionWorkspaceHubModel(input);
  if (!workspaceHub) return null;

  return {
    status: "ready" as const,
    changesLabel: changesLabel(workspaceHub.fileCount),
    additions: workspaceHub.additions,
    deletions: workspaceHub.deletions,
    href: workspaceHub.href,
  };
};
