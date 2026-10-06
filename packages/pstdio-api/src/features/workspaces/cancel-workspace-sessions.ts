import type { WorkspacesRouteDeps } from "./deps";

const ACTIVE_STATUSES = new Set(["queued", "in_progress", "awaiting_input"]);

// A workspace's agents run inside its working tree. Stop them through the session service, which
// owns status changes and their hooks, before the tree or the remote resource goes away.
export const cancelWorkspaceSessions = async (
  deps: Pick<WorkspacesRouteDeps, "workspaceSessionService" | "sessionService">,
  workspaceId: string,
) => {
  const sessions = await deps.workspaceSessionService.listByWorkspace(workspaceId);
  for (const session of sessions) {
    if (ACTIVE_STATUSES.has(session.status)) await deps.sessionService.cancel(session.id);
  }
};
