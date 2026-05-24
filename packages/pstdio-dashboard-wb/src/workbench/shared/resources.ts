import type { ResourceRef } from "pstdio-workbench/core";

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
  workspaces: createDashboardResource("dashboard-view", "workspaces", "Workspaces", "GitBranch"),
  sessions: createDashboardResource("dashboard-view", "sessions", "Sessions", "MessageCircle"),
  settings: createDashboardResource("project-settings", "settings", "Project settings", "Settings"),
} as const;

export const dashboardSettingsResources = {
  runtime: createDashboardResource("project-settings", "settings/runtime", "Runtime", "Cpu"),
  harnesses: createDashboardResource("project-settings", "settings/harnesses", "Harnesses", "Orbit"),
  extensions: createDashboardResource("project-settings", "settings/extensions", "Extensions", "Puzzle"),
  repositories: createDashboardResource("project-settings", "settings/repositories", "Repositories", "GitBranch"),
  attemptStatuses: createDashboardResource(
    "project-settings",
    "settings/attempt-statuses",
    "Attempt statuses",
    "CheckCircle",
  ),
  dangerZone: createDashboardResource("project-settings", "settings/danger-zone", "Danger Zone", "AlertTriangle"),
} as const;

export const createDashboardSettingsSkillResource = (skillName: string) =>
  createDashboardResource(
    "project-settings",
    `settings/skills/${encodeURIComponent(skillName)}`,
    skillName,
    "BookOpen",
  );

export const createDashboardSettingsTemplateResource = (templateName: string) =>
  createDashboardResource(
    "project-settings",
    `settings/templates/${encodeURIComponent(templateName)}`,
    templateName,
    "FileText",
  );

export const dashboardSettingsResourceGroups = [
  {
    id: "project-settings",
    resources: [
      dashboardSettingsResources.runtime,
      dashboardSettingsResources.harnesses,
      dashboardSettingsResources.extensions,
      dashboardSettingsResources.repositories,
    ],
  },
  {
    id: "workspaces",
    resources: [dashboardSettingsResources.attemptStatuses],
  },
  {
    id: "danger",
    resources: [dashboardSettingsResources.dangerZone],
  },
] as const;

export const dashboardSettingsResourceList = dashboardSettingsResourceGroups.flatMap((group) => group.resources);
