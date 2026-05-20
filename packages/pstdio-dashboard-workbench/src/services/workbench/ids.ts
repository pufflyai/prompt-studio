// Stable contribution ids shared between modules, renderers, navigation, and tests.

export const dashboardWidgetIds = {
  navTree: "pstdio-dashboard-workbench.nav-tree",
  projectHeader: "pstdio-dashboard-workbench.project-header",
  status: "pstdio-dashboard-workbench.status",
  ticketsBoard: "pstdio-dashboard-workbench.tickets-board",
  ticketDetail: "pstdio-dashboard-workbench.ticket-detail",
  workspacesOverview: "pstdio-dashboard-workbench.workspaces-overview",
  workspaceDetail: "pstdio-dashboard-workbench.workspace-detail",
  sessionsOverview: "pstdio-dashboard-workbench.sessions-overview",
  sessionChat: "pstdio-dashboard-workbench.session-chat",
  settings: "pstdio-dashboard-workbench.settings",
  extensionRoute: "pstdio-dashboard-workbench.extension-route",
} as const;

export const dashboardCommandIds = {
  openTickets: "dashboard.openTickets",
  openWorkspaces: "dashboard.openWorkspaces",
  openSessions: "dashboard.openSessions",
  openSettings: "dashboard.openSettings",
  toggleSessionChat: "dashboard.toggleSessionChat",
  back: "dashboard.goBack",
  forward: "dashboard.goForward",
  reopenClosed: "dashboard.reopenLastClosed",
} as const;
