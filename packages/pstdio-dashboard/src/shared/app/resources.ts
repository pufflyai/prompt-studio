import { type ResourceRef, standardResourceIcons } from "pstdio-workbench/core";

export const dashboardCollectionsProjectId = "dashboard-project";

export const createDashboardResource = (
  kind: string,
  id: string,
  label: string,
  icon: string,
  projectId = dashboardCollectionsProjectId,
  metadata: Record<string, unknown> = {},
) =>
  ({
    kind,
    uri: `dashboard-workbench://${kind}/${id}`,
    id,
    label,
    icon,
    metadata: { ...metadata, favoriteScope: { scope: "project", projectId } },
  }) satisfies ResourceRef;

export const dashboardResources = {
  start: createDashboardResource("dashboard-view", "start", "Start", "House"),
  workspaces: createDashboardResource("dashboard-view", "workspaces", "Workspaces", standardResourceIcons.workspace),
  sessions: createDashboardResource("dashboard-view", "sessions", "Sessions", "MessageCircle"),
} as const;
