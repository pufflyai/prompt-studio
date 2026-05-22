import type { ResourceRef } from "../../../../core";

export const dashboardCollectionsProjectId = "dashboard-project";

const dashboardFavoriteScope = { scope: "project", projectId: dashboardCollectionsProjectId } as const;

export const createResource = (kind: string, id: string, label: string, icon: string) =>
  ({
    kind,
    uri: `dashboard-workbench://${kind}/${id}`,
    id,
    label,
    icon,
    metadata: { favoriteScope: dashboardFavoriteScope },
  }) satisfies ResourceRef;

export const dashboardResources = {
  tickets: createResource("dashboard-view", "tickets", "Tickets", "KanbanSquare"),
  workspaces: createResource("dashboard-view", "workspaces", "Workspaces", "GitBranch"),
  sessions: createResource("dashboard-view", "sessions", "Sessions", "MessageCircle"),
  lab: createResource("extension-route", "lab", "Lab", "FlaskConical"),
  repoHealth: createResource("extension-route", "repo-health", "Repo health", "GitBranch"),
  changelog: createResource("extension-route", "changelog", "Changelog", "Workflow"),
  settings: createResource("project-settings", "settings", "Project settings", "Settings"),
} as const;

export const dashboardSettingsResources = {
  agents: createResource("project-settings", "settings/agents", "Agents", "Bot"),
  repositories: createResource("project-settings", "settings/repositories", "Repositories", "GitBranch"),
  labSettings: createResource("project-settings", "settings/lab", "Lab settings", "FlaskConical"),
  auditLog: createResource("project-settings", "settings/audit-log", "Audit log", "ClipboardList"),
  repoHealth: createResource("project-settings", "settings/repo-health", "Repo health", "GitBranch"),
} as const;
