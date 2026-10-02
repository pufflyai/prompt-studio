import type { DataTableRendererColumn, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardSelectedProjectIdContextKey, getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createDashboardWorkspaces, toWorkspaceDataTableRow } from "@/shared/workspaces/dashboard-workspaces";
import { requestDashboardWorkspaceDiffSummaries } from "@/shared/workspaces/workspace-diff-summary-data";
import { subscribeWorkspaceDataChanges } from "./workspace-data-subscription";

const workspaceColumns: DataTableRendererColumn[] = [
  { id: "name", label: "Name", stat: { type: "unique" } },
  {
    id: "type",
    label: "Type",
    groupable: true,
    stat: { type: "top-values", limit: 3 },
    renderer: {
      type: "badge",
      categories: [
        { value: "Project folder", palette: "gray" },
        { value: "Git worktree", palette: "purple" },
        { value: "Remote workspace", palette: "blue" },
      ],
    },
  },
  { id: "location", label: "Location", stat: { type: "unique" }, renderer: { type: "path" } },
  { id: "created", label: "Created at", renderer: { type: "date" } },
  { id: "diff", label: "Diff", renderer: { type: "diff" } },
  { id: "attempt", label: "Attempt", stat: { type: "unique" } },
  { id: "provider", label: "Provider", stat: { type: "top-values", limit: 5 } },
  { id: "state", label: "State", groupable: true, stat: { type: "top-values", limit: 2 } },
  { id: "error", label: "Provider error", stat: { type: "unique" } },
  { id: "branch", label: "Branch", stat: { type: "unique" } },
  { id: "updated", label: "Updated at", renderer: { type: "date" } },
];

// Diagnostic fields stay available from the Display menu without crowding the default list.
const defaultSettings = {
  showStats: false,
  hiddenColumns: ["attempt", "provider", "state", "error", "branch", "updated"],
};

const executeWorkspaceQuery = async (ctx: WorkbenchModuleContext, signal: AbortSignal) => {
  const workspaces = createDashboardWorkspaces(getDashboardSelectedProjectId(ctx), { includeArchived: true });

  await requestDashboardWorkspaceDiffSummaries(
    workspaces.filter((workspace) => !workspace.archived && workspace.supportsDiff).map((workspace) => workspace.id),
    signal,
  );

  return { rows: workspaces.map(toWorkspaceDataTableRow) };
};

export const registerWorkspaceDataTableView = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView(
    {
      id: dashboardWidgetIds.workspaces,
      title: "Workspaces",
      body: {
        kind: "dataTable",
        resourceKind: "workspace",
        columns: workspaceColumns,
        defaultSettings,
        emptyTitle: "No workspaces yet",
        emptyDescription: "Create a workspace to start an isolated attempt for this project.",
        contextKeys: [dashboardSelectedProjectIdContextKey],
        subscribe: (listener) => subscribeWorkspaceDataChanges(() => getDashboardSelectedProjectId(ctx), listener),
        executeQuery: (_context, signal) => executeWorkspaceQuery(ctx, signal),
        onRowActivate: (row) => {
          if (!row.resource) return;
          openWorkspacesPage(ctx, row.resource);
        },
      },
    },
    { priority: 85 },
  );
};
