import type {
  DataRendererFilterCategory,
  DataRendererOption,
  DataRendererRow,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { dashboardWidgetIds } from "../../../shared/widget-ids";
import { dashboardSessions } from "../mock-data/sessions";

interface DashboardSessionRow extends DataRendererRow {
  resource: ResourceRef;
}

const sessionStatusColumns = [
  { id: "in_progress", label: "In progress", color: "blue" },
  { id: "awaiting_input", label: "Awaiting input", color: "purple" },
  { id: "queued", label: "Queued", color: "yellow" },
  { id: "completed", label: "Completed", color: "green" },
] as const;

const sessionStatusColor = (status: string) =>
  sessionStatusColumns.find((column) => column.id === status)?.color ?? "gray";

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

export const toSessionRow = (session: (typeof dashboardSessions)[number]) => ({
  id: session.resource.uri,
  ticketId: session.workspaceShorthand,
  title: session.title,
  parentPath: ["Sessions"],
  status: session.status,
  statusColor: sessionStatusColor(session.status),
  updatedAt: session.updatedAt,
  resource: session.resource,
});

export const createSessionRows = () => dashboardSessions.map(toSessionRow);

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
