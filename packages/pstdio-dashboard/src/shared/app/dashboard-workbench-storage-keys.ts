export const dashboardWorkbenchStorageNamespace = "dashboard-wb";

export const dashboardProjectSelectionStorageKey = (namespace: string) => `${namespace}:selected-project:global`;

export const dashboardLastResourceStorageKey = (namespace: string, projectId: string) =>
  `${namespace}:last-resource:${projectId}`;

export const resolveDesktopWorkbenchStorageKey = (key: string) => {
  if (key === dashboardProjectSelectionStorageKey(dashboardWorkbenchStorageNamespace)) {
    return { kind: "selected-project" as const };
  }

  const prefix = `${dashboardWorkbenchStorageNamespace}:last-resource:`;
  if (!key.startsWith(prefix)) return undefined;
  const projectId = key.slice(prefix.length);
  return projectId ? { kind: "last-resource" as const, projectId } : undefined;
};
