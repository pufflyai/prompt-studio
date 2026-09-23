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
