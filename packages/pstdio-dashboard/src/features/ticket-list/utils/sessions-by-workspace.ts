import type { SyncedRow } from "@/features/sync/collections";

const RUNNING_STATUS = "in_progress";

const isRunningSession = (session: SyncedRow) => session.status === RUNNING_STATUS;

const getSessionLinkCreatedAt = (session: SyncedRow) =>
  (session.workspace_session_created_at as string | undefined) ?? "";

const shouldReplaceWorkspaceSession = (existing: SyncedRow | undefined, session: SyncedRow) => {
  if (!existing) return true;
  if (isRunningSession(existing) !== isRunningSession(session)) return isRunningSession(session);
  return getSessionLinkCreatedAt(session) > getSessionLinkCreatedAt(existing);
};

export const buildSessionsByWorkspace = (
  rawWorkspaceSessions: SyncedRow[] | undefined,
  rawSessions: SyncedRow[] | undefined,
) => {
  const sessionById = new Map((rawSessions ?? []).map((session) => [session.id, session]));
  const sessionsByWorkspace = new Map<string, SyncedRow>();

  for (const link of rawWorkspaceSessions ?? []) {
    const sessionId = link.session_id as string;
    const workspaceId = link.workspace_id as string;

    const session = sessionById.get(sessionId);
    if (!session) continue;
    if (session.archived) continue;

    const workspaceSession = { ...session, workspace_session_created_at: link.created_at };

    const existing = sessionsByWorkspace.get(workspaceId);
    if (shouldReplaceWorkspaceSession(existing, workspaceSession)) {
      sessionsByWorkspace.set(workspaceId, workspaceSession);
    }
  }

  return sessionsByWorkspace;
};
