import type { SyncedRow } from "@/features/sync/collections";

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

    // Keep the latest session per workspace (last link wins)
    const existing = sessionsByWorkspace.get(workspaceId);
    if (!existing || (link.created_at as string) > (existing.created_at as string)) {
      sessionsByWorkspace.set(workspaceId, session);
    }
  }

  return sessionsByWorkspace;
};
