import { normalizeWorkspacePageTab } from "./workspace-page-tab";

interface ResolveWorkspacePageSessionSearchInput {
  requestedSessionId: string | undefined;
  activeSessionId: string | null;
  requestedTab?: string;
  areWorkspaceSessionsReady: boolean;
}

export const resolveWorkspacePageSessionSearch = (input: ResolveWorkspacePageSessionSearchInput) => {
  const { requestedSessionId, activeSessionId, requestedTab, areWorkspaceSessionsReady } = input;
  if (!areWorkspaceSessionsReady) return null;

  const tab = normalizeWorkspacePageTab(requestedTab);
  if ((requestedSessionId ?? null) === activeSessionId && requestedTab === tab) return null;

  return activeSessionId ? { sessionId: activeSessionId, tab } : { tab };
};
