import {
  getAnchorResource,
  type ResourceRef,
  type TreeViewSection,
  type WorkbenchModuleContext,
} from "../../../../core";
import { dashboardTickets } from "../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { dashboardChangedFilePaths } from "./mock-data/workspaces";

const ticketFilePaths = [
  "ticket.md",
  "planning.md",
  "packages/pstdio-dashboard/src/features/project/pages/project-shell.tsx",
];

const sessionStatusIcon = (status: string) => {
  if (status === "completed") return "CircleCheck";
  if (status === "failed") return "CircleAlert";
  if (status === "cancelled") return "CircleStop";
  if (status === "disconnected") return "CirclePause";
  if (status === "queued") return "ClockAlert";
  return "CircleDashed";
};

const sessionStatusColor = (status: string) => {
  if (status === "completed") return "fg.success";
  if (status === "failed") return "fg.error";
  if (status === "cancelled" || status === "disconnected") return "fg.warning";
  if (status === "queued") return "fg.info";
  return "fg.muted";
};

const resolveTicketForResource = (resource: ResourceRef | undefined) => {
  if (!resource) return dashboardTickets[0];

  return (
    dashboardTickets.find(
      (ticket) => ticket.resource.uri === resource.uri || ticket.workspaceResource.uri === resource.uri,
    ) ?? dashboardTickets[0]
  );
};

const createWorkspaceDescription = (ticket: (typeof dashboardTickets)[number]) => {
  const diff = `${ticket.workspace.additions} additions, ${ticket.workspace.deletions} deletions`;

  return `${ticket.workspace.status.name}, ${diff}`;
};

const createResourceSection = (ticket: (typeof dashboardTickets)[number]): TreeViewSection => ({
  id: "resource",
  nodes: [
    {
      id: ticket.resource.uri,
      label: ticket.id,
      description: ticket.title,
      icon: ticket.resource.icon,
      resource: ticket.resource,
    },
    {
      id: ticket.workspaceResource.uri,
      label: `Attempt ${ticket.workspace.shorthand}`,
      description: createWorkspaceDescription(ticket),
      icon: ticket.workspaceResource.icon,
      resource: ticket.workspaceResource,
    },
  ],
});

const createFilesSection = (ticket: (typeof dashboardTickets)[number]): TreeViewSection => {
  const paths = ticket.workspace.type === "worktree" ? dashboardChangedFilePaths : ticketFilePaths;

  return {
    id: "files",
    label: "Files",
    collapsible: false,
    nodes: paths.map((path) => ({
      id: `${ticket.resource.uri}:file:${path}`,
      label: path,
      icon: "FileText",
      target: { kind: "command", commandId: "dashboard.openFile", args: { path } },
    })),
  };
};

const createSessionsSection = (ticket: (typeof dashboardTickets)[number]): TreeViewSection => ({
  id: "sessions",
  label: "Sessions",
  collapsible: false,
  nodes: ticket.workspace.sessions.map((session) => ({
    id: `${ticket.workspaceResource.uri}:session:${session.id}`,
    label: session.title,
    icon: sessionStatusIcon(session.status),
    iconColor: sessionStatusColor(session.status),
    target: { kind: "command", commandId: "dashboard.openSession", args: { sessionId: session.id } },
  })),
});

const createResourceSidenavSections = (resource: ResourceRef | undefined) => {
  const ticket = resolveTicketForResource(resource);

  return [createResourceSection(ticket), createFilesSection(ticket), createSessionsSection(ticket)];
};

export const registerResourceSidenavTree = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardWidgetIds.ticketSidenav,
    title: "Resource sidenav",
    // Body reflects the PRIMARY (main) resource, read at call time — it intentionally
    // ignores the tree's own placement resource. The module's onDidChangePrimaryResource
    // subscription calls refresh() after the detail widget lands in main, which is the
    // mechanism that re-derives this body for the new primary (and sets the selection).
    getBody: () => createResourceSidenavSections(getAnchorResource(ctx.layout.getLayout(), "primary")),
    getChildren: () => [],
  });
  ctx.layout.registerPanel(
    {
      closable: false,
      id: dashboardWidgetIds.ticketSidenav,
      title: "Resource sidenav",
      region: "sidenav",
      rendererId: dashboardWidgetIds.ticketSidenav,
      singleton: true,
    },
    { priority: 75 },
  );
};
