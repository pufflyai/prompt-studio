import type { SyncedRow } from "@/features/sync/collections";

export const buildSessionsByWorkspace = (
  rawWorkspaces: SyncedRow[] | undefined,
  rawSessions: SyncedRow[] | undefined,
) => {
  const sessionById = new Map((rawSessions ?? []).map((session) => [session.id, session]));
  const sessionsByWorkspace = new Map<string, SyncedRow>();

  for (const workspace of rawWorkspaces ?? []) {
    const sessionId = workspace.session_id as string | null;
    if (!sessionId) continue;

    const session = sessionById.get(sessionId);
    if (!session) continue;

    sessionsByWorkspace.set(workspace.id, session);
  }

  return sessionsByWorkspace;
};
