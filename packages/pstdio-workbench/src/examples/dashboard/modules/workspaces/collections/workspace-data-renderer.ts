import type {
  DataRendererFilterCategory,
  DataRendererOption,
  DataRendererRow,
  DataRendererTagDefinition,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import type { ResourceRef, WorkbenchModuleContributionContext } from "../../../../../core";
import { dashboardTickets } from "../../../shared/mock-data/tickets";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

type DashboardTicket = (typeof dashboardTickets)[number];

interface DashboardWorkspaceRow extends DataRendererRow {
  resource: ResourceRef;
}

const workspaceStatusColumns = [
  { id: "running", label: "Running", color: "blue" },
  { id: "queued", label: "Queued", color: "yellow" },
  { id: "review", label: "Review", color: "purple" },
  { id: "merged", label: "Merged", color: "green" },
] as const;

const workspaceTagDefinitions: DataRendererTagDefinition[] = [
  {
    name: "ticket",
    label: "Ticket",
    options: dashboardTickets.map((ticket) => ({ value: ticket.id, label: ticket.id, color: ticket.statusColor })),
  },
  {
    name: "type",
    label: "Type",
    options: [
      { value: "worktree", label: "Worktree", color: "blue" },
      { value: "current_branch", label: "Current branch", color: "gray" },
    ],
  },
];

const workspaceGroupingOptions: DataRendererOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "tag:ticket", label: "Ticket" },
  { value: "tag:type", label: "Type" },
  { value: "none", label: "None" },
];

const workspaceOrderingOptions: DataRendererOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
  { value: "ticketId", label: "Attempt" },
];

const workspaceDisplayPropertyOptions: DataRendererOption<DisplayProperty>[] = [
  { value: "id", label: "Attempt" },
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "updated", label: "Updated" },
  { value: "tag:ticket", label: "Ticket" },
  { value: "tag:type", label: "Type" },
];

const workspaceFilterCategories: DataRendererFilterCategory[] = [
  {
    id: "status",
    label: "Status",
    options: workspaceStatusColumns.map((column) => ({
      value: column.id,
      label: column.label,
      color: column.color,
    })),
  },
  {
    id: "assignee",
    label: "Assignee",
    options: [...new Set(dashboardTickets.map((ticket) => ticket.assignee))].map((assignee) => ({
      value: assignee,
      label: assignee,
    })),
  },
];

const normalizeStatus = (status: string) => status.toLowerCase().replaceAll(" ", "-");

const toWorkspaceRow = (ticket: DashboardTicket): DashboardWorkspaceRow => {
  const status = normalizeStatus(ticket.workspace.status.name);

  return {
    id: ticket.workspaceResource.uri,
    ticketId: ticket.workspace.shorthand,
    title: `${ticket.id} Attempt ${ticket.workspace.shorthand}`,
    parentPath: [ticket.id],
    status,
    statusColor: ticket.workspace.status.color,
    assignee: ticket.assignee,
    updatedAt: ticket.updatedAt,
    tags: [
      { name: "ticket", value: ticket.id },
      { name: "type", value: ticket.workspace.type },
    ],
    resource: ticket.workspaceResource,
  };
};

export const registerWorkspaceDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer<DashboardWorkspaceRow>({
    id: dashboardWidgetIds.workspaces,
    title: "Workspaces",
    resourceKind: "workspace",
    tagDefinitions: workspaceTagDefinitions,
    groupingOptions: workspaceGroupingOptions,
    orderingOptions: workspaceOrderingOptions,
    displayPropertyOptions: workspaceDisplayPropertyOptions,
    filterCategories: workspaceFilterCategories,
    knownColumnKeys: workspaceStatusColumns.map((column) => column.id),
    defaultSettings: {
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { field: "updated", direction: "desc" },
      displayProperties: ["id", "status", "assignee", "tag:ticket", "tag:type"],
    },
    executeQuery: () => dashboardTickets.map(toWorkspaceRow),
    onTicketClick: (row) => {
      void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.workspaces,
      title: "Workspaces",
      area: "main",
      rendererId: dashboardWidgetIds.workspaces,
      singleton: true,
    },
    { priority: 85 },
  );
};
