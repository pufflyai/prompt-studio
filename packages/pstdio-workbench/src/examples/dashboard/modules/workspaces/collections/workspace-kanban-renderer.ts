import type { AttributeDescriptor, KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import type { ResourceRef, WorkbenchModuleContext } from "../../../../../core";
import { dashboardTickets } from "../../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

type DashboardTicket = (typeof dashboardTickets)[number];

interface DashboardWorkspaceRow extends KanbanRendererRow {
  resource: ResourceRef;
  attributes: {
    id: string;
    status: string;
    assignee: string;
    ticket: string;
    type: "worktree" | "current_branch";
    updated: string;
  };
}

const workspaceStatusColumns = [
  { id: "running", label: "Running", color: "blue" },
  { id: "queued", label: "Queued", color: "yellow" },
  { id: "review", label: "Review", color: "purple" },
  { id: "merged", label: "Merged", color: "green" },
] as const;

const workspaceAttributes: AttributeDescriptor[] = [
  { id: "id", label: "Attempt", type: { kind: "string" }, displayable: true },
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: workspaceStatusColumns.map((column) => ({ value: column.id, label: column.label, color: column.color })),
    },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "ticket",
    label: "Ticket",
    type: {
      kind: "enum",
      options: dashboardTickets.map((ticket) => ({ value: ticket.id, label: ticket.id, color: ticket.statusColor })),
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "type",
    label: "Type",
    type: {
      kind: "enum",
      options: [
        { value: "worktree", label: "Worktree", color: "blue" },
        { value: "current_branch", label: "Current branch", color: "gray" },
      ],
    },
    groupable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
];

const normalizeStatus = (status: string) => status.toLowerCase().replaceAll(" ", "-");

const toWorkspaceRow = (ticket: DashboardTicket): DashboardWorkspaceRow => ({
  id: ticket.workspaceResource.uri,
  title: `${ticket.id} Attempt ${ticket.workspace.shorthand}`,
  resource: ticket.workspaceResource,
  attributes: {
    id: ticket.workspace.shorthand,
    status: normalizeStatus(ticket.workspace.status.name),
    assignee: ticket.assignee,
    ticket: ticket.id,
    type: ticket.workspace.type as DashboardWorkspaceRow["attributes"]["type"],
    updated: ticket.updatedAt,
  },
});

export const registerWorkspaceKanbanRenderer = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerKanbanRenderer<DashboardWorkspaceRow>({
    id: dashboardWidgetIds.workspaces,
    title: "Workspaces",
    resourceKind: "workspace",
    attributes: workspaceAttributes,
    defaultSettings: {
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { attributeId: "updated", direction: "desc" },
      displayProperties: ["id", "status", "assignee", "ticket", "type"],
    },
    executeQuery: () => dashboardTickets.map(toWorkspaceRow),
    onRowClick: (row) => {
      void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
  });
  ctx.layout.registerPanel(
    {
      closable: false,
      id: dashboardWidgetIds.workspaces,
      title: "Workspaces",
      region: "main",
      rendererId: dashboardWidgetIds.workspaces,
      singleton: true,
    },
    { priority: 85 },
  );
};
