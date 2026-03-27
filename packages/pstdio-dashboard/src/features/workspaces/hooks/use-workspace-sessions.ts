import { asSyncedRows, getCollection, useLiveQuery } from "@/features/sync/collections";

export interface WorkspaceSessionEntry {
  id: string;
  title: string;
  status: string;
  agent: string | null;
  createdAt: string;
}

export const useWorkspaceSessions = (workspaceIds: string[]) => {
  const { data: rawLinks } = useLiveQuery((q) =>
    q.from({ ws: getCollection("workspace_sessions") }).select(({ ws }) => ({ ...ws })),
  );

  const { data: rawSessions } = useLiveQuery((q) =>
    q.from({ s: getCollection("sessions") }).select(({ s }) => ({ ...s })),
  );

  const links = asSyncedRows(rawLinks) ?? [];
  const sessions = asSyncedRows(rawSessions) ?? [];
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const idSet = new Set(workspaceIds);

  const sessionsByWorkspaceId = new Map<string, WorkspaceSessionEntry[]>();

  for (const link of links) {
    const workspaceId = link.workspace_id as string;
    if (!idSet.has(workspaceId)) continue;

    const session = sessionById.get(link.session_id as string);
    if (!session) continue;

    const entry: WorkspaceSessionEntry = {
      id: session.id,
      title: (session.title as string) ?? "Session",
      status: (session.status as string) ?? "unknown",
      agent: (session.agent as string) ?? null,
      createdAt: (link.created_at as string) ?? "",
    };

    const existing = sessionsByWorkspaceId.get(workspaceId) ?? [];
    existing.push(entry);
    sessionsByWorkspaceId.set(workspaceId, existing);
  }

  // Sort sessions within each workspace by created_at ascending
  for (const [, entries] of sessionsByWorkspaceId) {
    entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return sessionsByWorkspaceId;
};
