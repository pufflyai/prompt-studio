import type {
  DataRendererFilterCategory,
  DataRendererOption,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createSessionRows, type DashboardSessionRow, subscribeDashboardData } from "../../../data/dashboard-data";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

const sessionStatusColumns = [
  { id: "in_progress", label: "In progress", color: "blue" },
  { id: "awaiting_input", label: "Awaiting input", color: "purple" },
  { id: "queued", label: "Queued", color: "yellow" },
  { id: "completed", label: "Completed", color: "green" },
] as const;

export const sessionGroupingOptions: DataRendererOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];

export const sessionOrderingOptions: DataRendererOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
];

export const sessionDisplayPropertyOptions: DataRendererOption<DisplayProperty>[] = [
  { value: "id", label: "Workspace" },
  { value: "status", label: "Status" },
  { value: "updated", label: "Updated" },
];

export const sessionFilterCategories: DataRendererFilterCategory[] = [
  {
    id: "status",
    label: "Status",
    options: sessionStatusColumns.map((column) => ({
      value: column.id,
      label: column.label,
      color: column.color,
    })),
  },
];

export { createSessionRows };

// The sessions overview is a board mirroring the workspaces board: each row is a
// session resource, so clicking one opens its chat through the shared opener.
export const registerSessionDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer<DashboardSessionRow>({
    id: dashboardWidgetIds.sessions,
    title: "Sessions",
    resourceKind: "session",
    groupingOptions: sessionGroupingOptions,
    orderingOptions: sessionOrderingOptions,
    displayPropertyOptions: sessionDisplayPropertyOptions,
    filterCategories: sessionFilterCategories,
    knownColumnKeys: sessionStatusColumns.map((column) => column.id),
    hideToolbar: true,
    subscribe: subscribeDashboardData,
    defaultSettings: {
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { field: "updated", direction: "desc" },
      displayProperties: ["id", "status", "updated"],
    },
    executeQuery: createSessionRows,
    onTicketClick: (row) => {
      void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
  });
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessions,
      title: "Sessions",
      area: "main",
      rendererId: dashboardWidgetIds.sessions,
      singleton: true,
    },
    { priority: 74 },
  );
};
