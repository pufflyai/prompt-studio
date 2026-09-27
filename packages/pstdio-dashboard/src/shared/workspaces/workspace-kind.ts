export const workspaceKind = (workspace: Record<string, unknown>) => {
  if (workspace.execution_kind === "remote") return "remote";
  if (workspace.provider_id === "pstdio.worktree") return "worktree";
  return "folder";
};

const workspaceKindIcons = { folder: "Folder", worktree: "GitBranch", remote: "Cloud" } as const;

// Every workspace resource takes its icon from here so the list, sidebars, and breadcrumbs agree.
export const workspaceIcon = (kind: ReturnType<typeof workspaceKind>) => workspaceKindIcons[kind];
