// Widget IDs are the cross-slice contract: a slice registers a widget under an
// id, and other slices (routing, bootstrap) open it by the same id.
export const dashboardWidgetIds = {
  sidebarHeader: "dashboard-workbench.sidebar-header",
  start: "dashboard-workbench.start",
  workspaces: "dashboard-workbench.workspaces",
  workspace: "dashboard-workbench.workspace",
  createWorkspace: "dashboard-workbench.create-workspace",
  renameWorkspace: "dashboard-workbench.rename-workspace",
  dashboardSidebar: "dashboard-workbench.sidebar",
  extensionRoute: "dashboard-workbench.extension-route",
  extensionView: "dashboard-workbench.extension-view",
  settings: "dashboard-workbench.settings",
  session: "dashboard-workbench.session",
  notificationsModal: "dashboard-workbench.notifications-modal",
  shortcutHelp: "dashboard-workbench.shortcut-help",
  projectPicker: "dashboard-workbench.project-picker",
  createProject: "dashboard-workbench.create-project",
  sessionBubble: "dashboard-workbench.session-bubble",
} as const;
