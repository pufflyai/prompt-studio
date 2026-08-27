import { DiffBubble } from "@pstdio/ui/diff";
import type { AttributeDescriptor, KanbanRendererRow, KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { createElement } from "react";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";
import { createDashboardWorkspaces, type DashboardWorkspaceRow, toWorkspaceRow } from "../data/dashboard-workspaces";

const renderWorkspaceDiffOverview = (_value: unknown, row: KanbanRendererRow) => {
  const additions = row.attributes.diffAdditions;
  const deletions = row.attributes.diffDeletions;

  if (typeof additions !== "number" || typeof deletions !== "number") return null;

  return createElement(DiffBubble, { additions, deletions, variant: "ghost", size: "small", fileName: undefined });
};

export const workspaceAttributes: AttributeDescriptor[] = [
  { id: "id", label: "Attempt", type: { kind: "string" }, displayable: true },
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
    filterable: true,
    groupable: true,
    displayable: true,
  },
  { id: "created", label: "Created", type: { kind: "date" }, sortable: true, displayable: true },
  { id: "updated", label: "Updated", type: { kind: "date" }, sortable: true, displayable: true },
  {
    id: "provider",
    label: "Provider",
    type: { kind: "string" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "state",
    label: "State",
    type: {
      kind: "enum",
      options: [
        { value: "provisioning", label: "Provisioning", color: "blue" },
        { value: "ready", label: "Ready", color: "green" },
        { value: "failed", label: "Failed", color: "red" },
        { value: "cancelled", label: "Cancelled", color: "gray" },
        { value: "archiving", label: "Archiving", color: "orange" },
        { value: "archived", label: "Archived", color: "gray" },
        { value: "deleting", label: "Deleting", color: "orange" },
        { value: "provider_missing", label: "Provider missing", color: "red" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  { id: "location", label: "Location", type: { kind: "string" }, displayable: true },
  { id: "error", label: "Provider error", type: { kind: "string" }, displayable: true },
  {
    id: "diffOverview",
    label: "Diff",
    type: { kind: "string" },
    displayable: true,
    render: renderWorkspaceDiffOverview,
  },
];

export const workspaceDefaultSettings: Partial<KanbanRendererSettings> = {
  viewMode: "list",
  columnGrouping: "none",
  rowGrouping: "none",
  ordering: { attributeId: "created", direction: "asc" },
  displayProperties: ["id", "type", "provider", "state", "location", "error", "diffOverview"],
};

const subscribeWorkspaceData = (ctx: WorkbenchModuleContext, listener: () => void) => {
  const unsubscribeData = subscribeDashboardData(listener);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, listener);
  const unsubscribeDiffSummaries = subscribeDashboardWorkspaceDiffSummaries(listener);

  return () => {
    unsubscribeData();
    unsubscribeProject();
    unsubscribeDiffSummaries();
  };
};

// Diff summaries load lazily over the API. We kick off the worktree requests on
// each query and rely on the diff-summary subscription to re-run the query once
// the totals land, so the board fills in its diff bubbles without a manual refresh.
const executeWorkspaceQuery = (ctx: WorkbenchModuleContext) => {
  const workspaces = createDashboardWorkspaces(getDashboardSelectedProjectId(ctx));

  void requestDashboardWorkspaceDiffSummaries(
    workspaces.filter((workspace) => workspace.type === "worktree").map((workspace) => workspace.id),
  );

  return workspaces.map(toWorkspaceRow);
};

export const registerWorkspaceKanbanRenderer = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerKanbanRenderer<DashboardWorkspaceRow>({
    id: dashboardWidgetIds.workspaces,
    title: "Workspaces",
    resourceKind: "workspace",
    attributes: workspaceAttributes,
    emptyTitle: "No workspaces yet",
    emptyDescription: "Create a workspace to start an isolated attempt for this project.",
    defaultSettings: workspaceDefaultSettings,
    subscribe: (listener) => subscribeWorkspaceData(ctx, listener),
    executeQuery: () => executeWorkspaceQuery(ctx),
    onRowActivate: (row) => {
      void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
  });
  ctx.layout.registerPanel(
    {
      id: dashboardWidgetIds.workspaces,
      title: "Workspaces",
      region: "main",
      rendererId: dashboardWidgetIds.workspaces,
      singleton: true,
    },
    { priority: 85 },
  );
};
