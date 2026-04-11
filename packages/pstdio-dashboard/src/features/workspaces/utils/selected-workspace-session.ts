import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";

export const resolveActiveWorkspaceSessionId = (
  sessions: WorkspaceSessionEntry[],
  requestedSessionId: string | undefined,
) => {
  if (sessions.length === 0) return null;
  if (requestedSessionId && sessions.some((session) => session.id === requestedSessionId)) {
    return requestedSessionId;
  }

  return sessions[0]?.id ?? null;
};
