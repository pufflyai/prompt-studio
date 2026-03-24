export const resolveProjectDefaultPath = (projectId?: string) => {
  if (!projectId) {
    return "/projects";
  }

  return `/projects/${projectId}/tickets`;
};
