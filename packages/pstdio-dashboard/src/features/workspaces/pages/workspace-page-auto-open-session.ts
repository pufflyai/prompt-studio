interface ResolveWorkspacePageAutoOpenSessionInput {
  isWorkspaceSessionsReady: boolean;
  requestedSessionId: string | undefined;
  activeSessionId: string | null;
  hasAutoOpenedSession: boolean;
}

export const resolveWorkspacePageAutoOpenSession = (input: ResolveWorkspacePageAutoOpenSessionInput) => {
  const { isWorkspaceSessionsReady, requestedSessionId, activeSessionId, hasAutoOpenedSession } = input;

  if (!isWorkspaceSessionsReady || requestedSessionId || !activeSessionId || hasAutoOpenedSession) {
    return null;
  }

  return activeSessionId;
};
