export const getAttemptLabelFromWorkspaceShorthand = (workspaceShorthand: string) => {
  const parts = workspaceShorthand.split("_");
  if (parts.length < 2) {
    return workspaceShorthand;
  }

  const attemptLabel = parts.at(-1)?.trim();
  if (!attemptLabel) {
    return workspaceShorthand;
  }

  return attemptLabel;
};
