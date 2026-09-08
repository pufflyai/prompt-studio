export const openProjectTab = (projectIds: readonly string[], projectId: string) =>
  projectIds.includes(projectId) ? projectIds : [...projectIds, projectId];

export const closeProjectTab = (projectIds: readonly string[], projectId: string, selectedProjectId?: string) => {
  const index = projectIds.indexOf(projectId);
  const remaining = projectIds.filter((id) => id !== projectId);
  return {
    projectIds: remaining,
    selectedProjectId:
      selectedProjectId === projectId ? remaining[Math.min(index, remaining.length - 1)] : selectedProjectId,
  };
};

export const reconcileProjectTabs = (projectIds: readonly string[], availableIds: readonly string[]) => {
  const available = new Set(availableIds);
  return projectIds.filter((id) => available.has(id));
};
