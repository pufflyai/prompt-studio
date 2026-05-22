// Widget IDs are the cross-slice contract: a slice registers a widget under an
// id, and other slices (routing, bootstrap) open it by the same id.
export const dashboardWidgetIds = {
  header: "dashboard-workbench.header",
  workspaces: "dashboard-workbench.workspaces",
  workspaceSidebar: "dashboard-workbench.workspace-sidebar",
  workspaceChanges: "dashboard-workbench.workspace.changes",
  workspaceChecks: "dashboard-workbench.workspace.checks",
  sessions: "dashboard-workbench.sessions",
  sessionsSidebar: "dashboard-workbench.sessions-sidebar",
  extensionRoute: "dashboard-workbench.extension-route",
  settings: "dashboard-workbench.settings",
  session: "dashboard-workbench.session",
  shortcutHelp: "dashboard-workbench.shortcut-help",
  sessionBubble: "dashboard-workbench.session-bubble",
  sessionBubbleHeader: "dashboard-workbench.session-bubble-header",
} as const;
