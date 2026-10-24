import type { SessionsRouteDeps } from "../deps";

export const resolveCreateWorkspace = async (
  deps: Pick<SessionsRouteDeps, "workspaceService">,
  projectId: string,
  workspaceId?: string,
) => {
  if (!workspaceId) {
    const workspace = await deps.workspaceService.getDefault(projectId);
    if (workspace) return { workspace };
    return { error: "Attach a workspace before starting a session.", status: 400 as const };
  }
  const workspace =
    (await deps.workspaceService.get(workspaceId)) ??
    (await deps.workspaceService.getByShorthand(projectId, workspaceId));
  if (!workspace || workspace.project_id !== projectId)
    return { error: `Workspace not found: ${workspaceId}`, status: 404 as const };
  return { workspace };
};

type FolderWorkspace = { is_default: boolean; execution_kind: string; root_path: string | null };

// A harness that works on files cannot start in a project whose folder is not on this device yet.
export const needsProjectFolder = (
  workspace: FolderWorkspace,
  harness: { cwdRequirement: "required" | "optional" } | undefined,
) =>
  workspace.is_default &&
  workspace.execution_kind === "local" &&
  !workspace.root_path &&
  harness?.cwdRequirement === "required";
