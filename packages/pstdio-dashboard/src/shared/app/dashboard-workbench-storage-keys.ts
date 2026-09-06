// Saved alpha.8 layouts carry the removed defaultOpen/required placement
// lifecycle and cannot seed the alpha.9 presence model; a new namespace
// discards them instead of guessing.
export const dashboardWorkbenchStorageNamespace = "dashboard-wb2";

export const dashboardProjectSelectionStorageKey = (namespace: string) => `${namespace}:selected-project:global`;

export const dashboardPageLocationStorageKey = (namespace: string, projectId: string) =>
  `${namespace}:page-location:${projectId}`;

export const resolveDesktopWorkbenchStorageKey = (key: string) => {
  if (key === dashboardProjectSelectionStorageKey(dashboardWorkbenchStorageNamespace)) {
    return { kind: "selected-project" as const };
  }

  const prefix = `${dashboardWorkbenchStorageNamespace}:page-location:`;
  if (!key.startsWith(prefix)) return undefined;
  const projectId = key.slice(prefix.length);
  return projectId ? { kind: "page-location" as const, projectId } : undefined;
};
