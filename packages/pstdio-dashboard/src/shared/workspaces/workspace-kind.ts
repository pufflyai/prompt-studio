export const workspaceKind = (workspace: Record<string, unknown>) => {
  if (workspace.execution_kind === "remote") return "remote";
  if (workspace.provider_id === "pstdio.worktree") return "worktree";
  return "folder";
};
