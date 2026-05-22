import type {
  DataRendererFilterCategory,
  DataRendererOption,
  DataRendererRow,
  DataRendererSettings,
  DataRendererTagDefinition,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "../../../shared/widget-ids";
import { type DashboardWorkspace, dashboardWorkspaces } from "../mock-data/workspaces";

interface DashboardWorkspaceRow extends DataRendererRow {
  resource: ResourceRef;
}

const workspaceStatusColumns = [
  { id: "running", label: "Running", color: "blue" },
  { id: "queued", label: "Queued", color: "yellow" },
  { id: "review", label: "Review", color: "purple" },
  { id: "merged", label: "Merged", color: "green" },
] as const;

export const workspaceTagDefinitions: DataRendererTagDefinition[] = [
  {
    name: "type",
    label: "Type",
    options: [
      { value: "worktree", label: "Worktree", color: "blue" },
      { value: "current_branch", label: "Current branch", color: "gray" },
    ],
  },
];

export const workspaceGroupingOptions: DataRendererOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "tag:type", label: "Type" },
  { value: "none", label: "None" },
];

export const workspaceOrderingOptions: DataRendererOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
];

export const workspaceDisplayPropertyOptions: DataRendererOption<DisplayProperty>[] = [
  { value: "id", label: "Attempt" },
  { value: "status", label: "Status" },
  { value: "updated", label: "Updated" },
  { value: "tag:type", label: "Type" },
];

export const workspaceFilterCategories: DataRendererFilterCategory[] = [
  {
    id: "status",
    label: "Status",
    options: workspaceStatusColumns.map((column) => ({
      value: column.id,
      label: column.label,
      color: column.color,
    })),
  },
];

export const workspaceDefaultSettings: Partial<DataRendererSettings> = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { field: "updated", direction: "desc" },
  displayProperties: ["id", "status", "tag:type"],
};

const normalizeStatus = (status: string) => status.toLowerCase().replaceAll(" ", "-");

export const toWorkspaceRow = (workspace: DashboardWorkspace) => {
  const status = normalizeStatus(workspace.status.name);

  return {
    id: workspace.resource.uri,
    ticketId: workspace.shorthand,
    title: workspace.title,
    parentPath: ["Workspaces"],
    status,
    statusColor: workspace.status.color,
    updatedAt: workspace.updatedAt,
    tags: [{ name: "type", value: workspace.type }],
    resource: workspace.resource,
  };
};

export const createWorkspaceRows = () => dashboardWorkspaces.map(toWorkspaceRow);

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
    hideToolbar: true,
    defaultSettings: workspaceDefaultSettings,
    executeQuery: createWorkspaceRows,
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
