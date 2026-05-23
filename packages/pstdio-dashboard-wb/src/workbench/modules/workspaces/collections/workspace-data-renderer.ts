import type {
  DataRendererFilterCategory,
  DataRendererOption,
  DataRendererSettings,
  DataRendererTagDefinition,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import i18n from "i18next";
import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createWorkspaceRows, type DashboardWorkspaceRow, subscribeDashboardData } from "../../../data/dashboard-data";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "../../../shared/project-context";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

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

export { createWorkspaceRows };

const subscribeWorkspaceData = (ctx: WorkbenchModuleContributionContext, listener: () => void) => {
  const unsubscribeDashboardData = subscribeDashboardData(listener);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, listener);

  return () => {
    unsubscribeDashboardData();
    unsubscribeProject();
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
    hideToolbar: true,
    emptyTitle: i18n.t("workspaces.empty.title"),
    emptyDescription: i18n.t("workspaces.empty.description"),
    defaultSettings: workspaceDefaultSettings,
    subscribe: (listener) => subscribeWorkspaceData(ctx, listener),
    executeQuery: () => createWorkspaceRows(getDashboardSelectedProjectId(ctx)),
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
