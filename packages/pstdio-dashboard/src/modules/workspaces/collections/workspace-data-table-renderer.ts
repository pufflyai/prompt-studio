import type { DataTableRendererColumn, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createDashboardWorkspaces, toWorkspaceDataTableRow } from "@/shared/workspaces/dashboard-workspaces";
import { requestDashboardWorkspaceDiffSummaries } from "@/shared/workspaces/workspace-diff-summary-data";
import { subscribeWorkspaceDataChanges } from "./workspace-data-subscription";

const workspaceColumns: DataTableRendererColumn[] = [
  { id: "attempt", label: "Attempt", stat: { type: "unique" } },
  { id: "name", label: "Name", stat: { type: "unique" } },
  { id: "type", label: "Type", stat: { type: "top-values", limit: 2 } },
  { id: "provider", label: "Provider", stat: { type: "top-values", limit: 5 } },
  { id: "state", label: "State", stat: { type: "top-values", limit: 2 } },
  { id: "location", label: "Location", stat: { type: "unique" } },
  { id: "error", label: "Provider error", stat: { type: "unique" } },
  { id: "branch", label: "Branch", stat: { type: "unique" } },
  { id: "created", label: "Created" },
  { id: "updated", label: "Updated" },
  { id: "diff", label: "Diff" },
];

const subscribeWorkspaceData = (ctx: WorkbenchModuleContext, listener: () => void) => {
  const unsubscribeData = subscribeWorkspaceDataChanges(() => getDashboardSelectedProjectId(ctx), listener);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, listener);

  return () => {
    unsubscribeData();
    unsubscribeProject();
  };
};

const executeWorkspaceQuery = async (ctx: WorkbenchModuleContext, signal: AbortSignal) => {
  const workspaces = createDashboardWorkspaces(getDashboardSelectedProjectId(ctx), { includeArchived: true });

  await requestDashboardWorkspaceDiffSummaries(
    workspaces
      .filter((workspace) => !workspace.archived && workspace.type === "worktree")
      .map((workspace) => workspace.id),
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
        emptyTitle: "No workspaces yet",
        emptyDescription: "Create a workspace to start an isolated attempt for this project.",
        subscribe: (listener) => subscribeWorkspaceData(ctx, listener),
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
