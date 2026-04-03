import type { RouteDeps } from "../deps";
import { cleanupWorkspaceWorktree } from "./worktree-cleanup";

type ArchiveWorkspaceCascadeDeps = Pick<
  RouteDeps,
  "repoService" | "sessionService" | "workspaceService" | "workspaceSessionService"
>;

type WorkspaceRecord = NonNullable<Awaited<ReturnType<RouteDeps["workspaceService"]["get"]>>>;

export const archiveWorkspaceCascade = async (deps: ArchiveWorkspaceCascadeDeps, workspace: WorkspaceRecord) => {
  const updated = workspace.archived ? workspace : await deps.workspaceService.archive(workspace.id);
  if (!updated) return null;

  const sessions = await deps.workspaceSessionService.listByWorkspace(workspace.id);
  const activeSessions = sessions.filter((session) => !session.archived);

  await Promise.all(activeSessions.map((session) => deps.sessionService.archive(session.id)));
  await cleanupWorkspaceWorktree(deps, workspace);

  return updated;
};
