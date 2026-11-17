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
export const createDashboardSessionResource = (
  id: string,
  label: string,
  projectId: string | undefined,
  metadata: Record<string, unknown> = {},
) => ({
  ...createDashboardResource("session", id, label, "message-circle", projectId, metadata),
  extensionId: "pstdio",
  projectId,
});
export const dashboardViews = {
  workspaces: { id: "workspaces", label: "Workspaces", icon: standardResourceIcons.workspace },
  sessions: { id: "sessions", label: "Sessions", icon: "messages-circle" },
} as const;

export const dashboardExtensionsPage = { kind: "page", extensionId: "pstdio", id: "extensions" } as const;
export const dashboardExtensionDetailPage = { ...dashboardExtensionsPage, id: "extension-detail" } as const;

export const dashboardHomePage = { kind: "page", extensionId: "pstdio.home", id: "home" } as const;
