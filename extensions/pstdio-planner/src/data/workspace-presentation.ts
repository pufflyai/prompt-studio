import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";

export const workspacePresentation = (workspace: ExtensionWorkspace) => {
  if (workspace.execution_kind === "remote") return { workspaceType: "remote", icon: "Cloud" } as const;
  if (workspace.provider_id === "pstdio.worktree") return { workspaceType: "worktree", icon: "GitBranch" } as const;
  return { workspaceType: "folder", icon: "Folder" } as const;
};
