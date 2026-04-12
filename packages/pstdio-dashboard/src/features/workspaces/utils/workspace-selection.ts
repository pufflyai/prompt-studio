import type { WorkspaceSessionEntry } from "../hooks/use-workspace-sessions";

interface ResolveWorkspaceSelectionInput {
  sessions: WorkspaceSessionEntry[];
}

interface WorkspaceSelection {
  search: { sessionId?: string };
  sessionIdToOpen: string | null;
  shouldClearSelection: boolean;
}

export const resolveWorkspaceSelection = (input: ResolveWorkspaceSelectionInput): WorkspaceSelection => {
  const sessionId = input.sessions[0]?.id ?? null;

  return {
    search: sessionId ? { sessionId } : {},
    sessionIdToOpen: sessionId,
    shouldClearSelection: sessionId === null,
  };
};
