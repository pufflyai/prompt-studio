// Widget IDs are the cross-slice contract: a slice registers a widget under an
// id, and other slices (routing, bootstrap) open it by the same id.
export const dashboardWidgetIds = {
  header: "dashboard-workbench.header",
  leftHeader: "dashboard-workbench.left-header",
  start: "dashboard-workbench.start",
  workspaces: "dashboard-workbench.workspaces",
  workspace: "dashboard-workbench.workspace",
  createWorkspace: "dashboard-workbench.create-workspace",
  renameWorkspace: "dashboard-workbench.rename-workspace",
  projectSidebar: "dashboard-workbench.project-sidebar",
  workspaceSidebar: "dashboard-workbench.workspace-sidebar",
  extensionRoute: "dashboard-workbench.extension-route",
  extensionView: "dashboard-workbench.extension-view",
  sessionsSidebar: "dashboard-workbench.sessions-sidebar",
  settings: "dashboard-workbench.settings",
  session: "dashboard-workbench.session",
  shortcutHelp: "dashboard-workbench.shortcut-help",
  projectPicker: "dashboard-workbench.project-picker",
  createProject: "dashboard-workbench.create-project",
  sessionBubble: "dashboard-workbench.session-bubble",
  sessionBubbleHeader: "dashboard-workbench.session-bubble-header",
} as const;
