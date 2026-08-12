// Widget IDs are the cross-slice contract: a slice registers a widget under an
// id, and other slices (routing, bootstrap) open it by the same id.
export const dashboardWidgetIds = {
  projectHeader: "dashboard-workbench.project-header",
  start: "dashboard-workbench.start",
  workspaces: "dashboard-workbench.workspaces",
  workspace: "dashboard-workbench.workspace",
  createWorkspace: "dashboard-workbench.create-workspace",
  renameWorkspace: "dashboard-workbench.rename-workspace",
  dashboardSidenav: "dashboard-workbench.sidenav",
  extensionRoute: "dashboard-workbench.extension-route",
  extensionView: "dashboard-workbench.extension-view",
  activityRail: "dashboard-workbench.activity-rail",
  settings: "dashboard-workbench.settings",
  session: "dashboard-workbench.session",
  notificationsModal: "dashboard-workbench.notifications-modal",
  shortcutHelp: "dashboard-workbench.shortcut-help",
  projectPicker: "dashboard-workbench.project-picker",
  createProject: "dashboard-workbench.create-project",
  sessionBubble: "dashboard-workbench.session-bubble",
} as const;
