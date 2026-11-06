import { type ExtensionWorkspace, workspacePages } from "@pstdio/sdk/extensions";

export const workspacePresentation = (workspace: ExtensionWorkspace) => {
  if (workspace.execution_kind === "remote") return { workspaceType: "remote", icon: "Cloud" } as const;
  if (workspace.provider_id === "pstdio.worktree") return { workspaceType: "worktree", icon: "GitBranch" } as const;
  return { workspaceType: "folder", icon: "Folder" } as const;
};

export const workspacePage = (workspace: ExtensionWorkspace) => {
  if (workspace.device) return workspacePages.history;
  if (
    (workspace.executionKind ?? workspace.execution_kind) === "remote" ||
    (workspace.capabilities ?? workspace.provider_capabilities_json)?.files === "none"
  )
    return workspacePages.overview;
  if (
    (workspace.isDefault ?? workspace.is_default) ||
    (workspace.capabilities ?? workspace.provider_capabilities_json)?.diff === false
  )
    return workspacePages.files;
  return workspacePages.workspace;
};
