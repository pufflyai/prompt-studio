import { type ResourceRef, standardResourceIcons } from "../../../../core";
import { settingsPanelResource } from "../../../../react";

export const createResource = (kind: string, id: string, label: string, icon: string) =>
  ({
    kind,
    uri: `dashboard-workbench://${kind}/${id}`,
    id,
    label,
    icon,
  }) satisfies ResourceRef;

// The default settings entry: a workbench settings panel resource so opening it
// routes through the shared settings surface.
export const dashboardDefaultSettingsPanel = { id: "runtime", title: "Runtime", icon: standardResourceIcons.settings };

export const dashboardResources = {
  tickets: createResource("dashboard-view", "tickets", "Tickets", "square-kanban"),
  workspaces: createResource("dashboard-view", "workspaces", "Workspaces", standardResourceIcons.workspace),
  sessions: createResource("dashboard-view", "sessions", "Sessions", "MessageCircle"),
  lab: createResource("extension-route", "lab", "Lab", "FlaskConical"),
  repoHealth: createResource("extension-route", "repo-health", "Repo health", "GitBranch"),
  changelog: createResource("extension-route", "changelog", "Changelog", "Workflow"),
  settings: settingsPanelResource(dashboardDefaultSettingsPanel),
} as const;
