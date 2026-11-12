// Widget IDs are the cross-slice contract: a slice registers a widget under an
// id, and other slices (routing, bootstrap) open it by the same id.
export const dashboardWidgetIds = {
  projectHeader: "dashboard-workbench.project-header",
  extensions: "dashboard-workbench.extensions",
  dashboardSidenav: "dashboard-workbench.sidenav",
  extensionPanelRenderer: "dashboard-workbench.extension-panel-renderer",
  activityRail: "dashboard-workbench.activity-rail",
  settings: "dashboard-workbench.settings",
  session: "dashboard-workbench.session",
  notificationsModal: "dashboard-workbench.notifications-modal",
  shortcutHelp: "dashboard-workbench.shortcut-help",
  projectPicker: "dashboard-workbench.project-picker",
  createProject: "dashboard-workbench.create-project",
  projectFolder: "dashboard-workbench.project-folder",
  sessionBubble: "dashboard-workbench.session-bubble",
} as const;
