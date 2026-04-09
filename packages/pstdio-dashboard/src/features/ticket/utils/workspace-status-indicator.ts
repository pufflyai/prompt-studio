export interface WorkspaceAttemptStatus {
  name: string;
  color: string;
  description?: string | null;
}

export const buildWorkspaceStatusIndicatorTooltip = (status: WorkspaceAttemptStatus | undefined) => {
  if (!status) return null;

  if (status.description) {
    return `${status.name}: ${status.description}`;
  }

  return status.name;
};
