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

export const dashboardViews = {
  tickets: { id: "tickets", label: "Tickets", icon: "square-kanban" },
  workspaces: { id: "workspaces", label: "Workspaces", icon: standardResourceIcons.workspace },
  sessions: { id: "sessions", label: "Sessions", icon: "MessageCircle" },
  lab: { id: "lab", label: "Lab", icon: "FlaskConical" },
  repoHealth: { id: "repo-health", label: "Repo health", icon: "GitBranch" },
  changelog: { id: "changelog", label: "Changelog", icon: "Workflow" },
} as const;

export const dashboardResources = {
  settings: settingsPanelResource(dashboardDefaultSettingsPanel),
} as const;
