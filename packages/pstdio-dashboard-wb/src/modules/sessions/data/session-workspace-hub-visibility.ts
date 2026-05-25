export const shouldShowSessionWorkspaceHub = (input: {
  workspaceId: string | null;
  activeModeId: string | undefined;
}) => input.workspaceId !== null && input.activeModeId !== "workspace";
