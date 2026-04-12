export interface WorkspaceDiffTotals {
  additions: number;
  deletions: number;
}

export const resolveWorkspaceDiffTotalLabel = (
  diffTotalsByWorkspaceId: Map<string, WorkspaceDiffTotals>,
  workspaceId: string,
) => {
  const totals = diffTotalsByWorkspaceId.get(workspaceId);
  if (!totals) return null;

  return `+${totals.additions} -${totals.deletions}`;
};
