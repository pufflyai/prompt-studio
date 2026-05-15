import type { ResourceRef } from "../../../core";

export type LeftPanelMode = "project" | "workspace" | "settings";

export interface LeftPanelSetup {
  title: string;
  icon: string;
}

export const leftPanelSetups = {
  project: { title: "Prompt Studio", icon: "FolderGit2" },
  workspace: { title: "Workspace", icon: "GitBranch" },
  settings: { title: "Project settings", icon: "Settings" },
} satisfies Record<LeftPanelMode, LeftPanelSetup>;

export const workspaceResources = {
  changes: {
    kind: "workspace",
    uri: "pstdio://workspace/workspace-ps-266/changes",
    id: "workspace-ps-266-changes",
    label: "Changed files",
    icon: "ListTree",
  },
  checks: {
    kind: "workspace",
    uri: "pstdio://workspace/workspace-ps-266/checks",
    id: "workspace-ps-266-checks",
    label: "Checks",
    icon: "ListChecks",
  },
} satisfies Record<string, ResourceRef>;

export const settingsResources = {
  templates: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/templates",
    id: "project-settings-templates",
    label: "Templates",
    icon: "FileText",
  },
  skills: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/skills",
    id: "project-settings-skills",
    label: "Skills",
    icon: "Sparkles",
  },
  statuses: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/statuses",
    id: "project-settings-statuses",
    label: "Statuses",
    icon: "ListChecks",
  },
  shortcuts: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/shortcuts",
    id: "project-settings-shortcuts",
    label: "Shortcuts",
    icon: "Keyboard",
  },
} satisfies Record<string, ResourceRef>;
