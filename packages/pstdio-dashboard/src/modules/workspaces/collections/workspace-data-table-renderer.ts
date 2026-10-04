import type { DataTableRendererColumn, WorkbenchModuleContext } from "@pstdio/workbench";
import { workspaceCollectionColumns, workspaceCollectionDefaults } from "pstdio-api-contracts";
import { dashboardSelectedProjectIdContextKey, getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createDashboardWorkspaces, toWorkspaceDataTableRow } from "@/shared/workspaces/dashboard-workspaces";
import { requestDashboardWorkspaceDiffSummaries } from "@/shared/workspaces/workspace-diff-summary-data";
import { subscribeWorkspaceDataChanges } from "./workspace-data-subscription";
import { createWorkspaceViewsProvider } from "./workspace-views";

const presentation: Record<string, Pick<DataTableRendererColumn, "stat" | "renderer">> = {
  name: { stat: { type: "unique" } },
  type: {
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
  location: { stat: { type: "unique" }, renderer: { type: "path" } },
  created: { renderer: { type: "date" } },
  diff: { renderer: { type: "diff" } },
  attempt: { stat: { type: "unique" } },
  provider: { stat: { type: "top-values", limit: 5 } },
  state: { stat: { type: "top-values", limit: 2 } },
  error: { stat: { type: "unique" } },
  branch: { stat: { type: "unique" } },
  updated: { renderer: { type: "date" } },
};
const workspaceColumns = workspaceCollectionColumns.map((column) => ({ ...column, ...presentation[column.id] }));

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
        defaultSettings: workspaceCollectionDefaults,
        viewsProvider: createWorkspaceViewsProvider(ctx),
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
