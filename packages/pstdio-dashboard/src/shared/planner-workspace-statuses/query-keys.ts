export const projectAttemptStatusesQueryKey = (projectId: string | undefined) =>
  ["planner-workspace-status-definitions", projectId] as const;

export const attemptStatusMapQueryKey = (projectId: string | undefined) =>
  ["planner-workspace-status-map-definitions", projectId] as const;

export const plannerWorkspaceStatusDefinitionQueryKeys = (projectId: string | undefined) => [
  projectAttemptStatusesQueryKey(projectId),
  attemptStatusMapQueryKey(projectId),
];
