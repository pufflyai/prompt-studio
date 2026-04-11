interface ResolveWorkspacePageSessionSearchInput {
  requestedSessionId: string | undefined;
  activeSessionId: string | null;
  areWorkspaceSessionsReady: boolean;
}

export const resolveWorkspacePageSessionSearch = (input: ResolveWorkspacePageSessionSearchInput) => {
  const { requestedSessionId, activeSessionId, areWorkspaceSessionsReady } = input;
  if (!areWorkspaceSessionsReady) return null;
  if ((requestedSessionId ?? null) === activeSessionId) return null;

  return activeSessionId ? { sessionId: activeSessionId } : {};
};
