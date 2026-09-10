export const openProjectTab = (projectIds: readonly string[], projectId: string) =>
  projectIds.includes(projectId) ? projectIds : [...projectIds, projectId];

export const reorderProjectTab = (projectIds: readonly string[], projectId: string, targetId: string) => {
  const from = projectIds.indexOf(projectId);
  const to = projectIds.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return projectIds;
  const reordered = [...projectIds];
  reordered.splice(from, 1);
  reordered.splice(to, 0, projectId);
  return reordered;
};

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
