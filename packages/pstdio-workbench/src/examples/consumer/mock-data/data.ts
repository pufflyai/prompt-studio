import { type MenuPath, type ResourceRef, workbenchCommandPaletteMenuPath } from "../../../core";

export const commandPaletteMenuPath: MenuPath = workbenchCommandPaletteMenuPath;
export const resourceContextMenuPath = ["resourceContext"] as const satisfies MenuPath;
export const helpMenuPath = ["project", "help"] as const satisfies MenuPath;

export const workbenchLifecyclePhases = ["activate", "reload"] as const;

export const workbenchPreferenceNames = [
  "project.autoOpenSession",
  "project.defaultWorkspace",
  "project.ticketGrouping",
  "extensionLab.reviewMode",
] as const;

export const workbenchWidgetIds = {
  overview: "project.overview",
  tickets: "project.tickets",
  workspace: "project.workspace",
  settings: "project.settings",
  registryInventory: "workbench.registry.inventory",
  checks: "project.checks",
  session: "session.assistant",
  extensionReview: "extension-lab.review.panel",
} as const;

const createResource = (kind: string, id: string, label: string, icon: string) =>
  ({
    kind,
    uri: `pstdio://${kind}/${id}`,
    id,
    label,
    icon,
  }) satisfies ResourceRef;

export const workbenchExampleResources = {
  project: createResource("project", "prompt-studio", "Prompt Studio", "FolderGit2"),
  tickets: createResource("dashboard-view", "tickets", "Tickets", "KanbanSquare"),
  ticket266: createResource("ticket", "PS-266", "PS-266 Workbench examples", "Ticket"),
  ticket267: createResource("ticket", "PS-267", "PS-267 Extension webviews", "Ticket"),
  workspace: createResource("workspace", "workspace-ps-266", "Workspace PS-266", "GitBranch"),
  workspace267: createResource("workspace", "workspace-ps-267", "PS-267 Extension webviews", "GitBranch"),
  registryInventory: createResource("dashboard-view", "registry-inventory", "Registry inventory", "Boxes"),
  settings: createResource("settings", "project-settings", "Project settings", "Settings"),
  extensionReview: createResource("extension-review", "extension-lab-review", "Extension Lab review", "Puzzle"),
} as const;

export const workbenchExampleTickets = [
  {
    id: "PS-266",
    title: "Move workbench stories into examples",
    status: "In progress",
    severity: "warning",
    resource: workbenchExampleResources.ticket266,
  },
  {
    id: "PS-267",
    title: "Render runtime extension webviews",
    status: "Ready",
    severity: "info",
    resource: workbenchExampleResources.ticket267,
  },
  {
    id: "PS-268",
    title: "Document registry ownership",
    status: "Done",
    severity: "success",
    resource: createResource("ticket", "PS-268", "PS-268 Registry ownership", "Ticket"),
  },
] as const;
