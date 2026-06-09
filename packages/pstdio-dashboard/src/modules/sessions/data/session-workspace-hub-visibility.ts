export const shouldShowSessionWorkspaceHub = (input: {
  sessionId: string | undefined;
  workspaceId: string | null | undefined;
  activeModeId: string | undefined;
}) => Boolean(input.sessionId && input.workspaceId) && input.activeModeId !== "workspace";
