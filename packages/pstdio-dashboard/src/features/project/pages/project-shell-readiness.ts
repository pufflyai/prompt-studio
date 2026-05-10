export const shouldRenderProjectOutlet = (params: {
  projectId: string | undefined;
  hasProject: boolean;
  isProjectLoading: boolean;
}) => {
  const { projectId, hasProject, isProjectLoading } = params;

  return Boolean(projectId && (hasProject || isProjectLoading));
};
