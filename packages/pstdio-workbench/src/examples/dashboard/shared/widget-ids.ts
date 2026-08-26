// Widget IDs are the cross-slice contract: a slice registers a widget under an
// id, and other slices (routing, bootstrap) open it by the same id.
export const dashboardWidgetIds = {
  tickets: "dashboard-workbench.tickets",
  workspaces: "dashboard-workbench.workspaces",
  workspace: "dashboard-workbench.workspace",
  ticketSidenav: "dashboard-workbench.ticket-sidenav",
  sessions: "dashboard-workbench.sessions",
  extensionPage: "dashboard-workbench.extension-page",
  status: "dashboard-workbench.status",
  session: "dashboard-workbench.session",
} as const;
