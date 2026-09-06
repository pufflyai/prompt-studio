import { type ResourceRef, standardResourceIcons } from "@pstdio/workbench";
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
    type: kind,
    id,
    label,
    icon,
    metadata: { ...metadata, favoriteScope: { scope: "project", projectId } },
  }) satisfies ResourceRef;
export const dashboardViews = {
  start: { id: "start", label: "Start", icon: "House" },
  workspaces: { id: "workspaces", label: "Workspaces", icon: standardResourceIcons.workspace },
  sessions: { id: "sessions", label: "Sessions", icon: "MessageCircle" },
} as const;
