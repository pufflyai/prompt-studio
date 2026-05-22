import type { ResourceRef } from "pstdio-workbench/core";

export const dashboardCollectionsProjectId = "dashboard-project";

export const createDashboardResource = (
  kind: string,
  id: string,
  label: string,
  icon: string,
  projectId = dashboardCollectionsProjectId,
) =>
  ({
    kind,
    uri: `dashboard-workbench://${kind}/${id}`,
    id,
    label,
    icon,
    metadata: { favoriteScope: { scope: "project", projectId } },
  }) satisfies ResourceRef;

export const dashboardResources = {
  workspaces: createDashboardResource("dashboard-view", "workspaces", "Workspaces", "GitBranch"),
  sessions: createDashboardResource("dashboard-view", "sessions", "Sessions", "MessageCircle"),
  lab: createDashboardResource("extension-route", "lab", "Lab", "FlaskConical"),
  repoHealth: createDashboardResource("extension-route", "repo-health", "Repo health", "GitBranch"),
  changelog: createDashboardResource("extension-route", "changelog", "Changelog", "Workflow"),
  settings: createDashboardResource("project-settings", "settings", "Project settings", "Settings"),
} as const;

export const dashboardSettingsResources = {
  agents: createDashboardResource("project-settings", "settings/agents", "Agents", "Bot"),
  repositories: createDashboardResource("project-settings", "settings/repositories", "Repositories", "GitBranch"),
  labSettings: createDashboardResource("project-settings", "settings/lab", "Lab settings", "FlaskConical"),
  auditLog: createDashboardResource("project-settings", "settings/audit-log", "Audit log", "ClipboardList"),
  repoHealth: createDashboardResource("project-settings", "settings/repo-health", "Repo health", "GitBranch"),
} as const;
