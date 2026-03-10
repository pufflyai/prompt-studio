export const isProjectQueryLoading = (params: {
  projectId: string | undefined;
  rawProject: unknown[] | undefined;
  isProjectLoading: boolean;
}) => {
  const { projectId, rawProject, isProjectLoading } = params;

  if (isProjectLoading) {
    return true;
  }

  if (!projectId) {
    return false;
  }

  return rawProject === undefined;
};
