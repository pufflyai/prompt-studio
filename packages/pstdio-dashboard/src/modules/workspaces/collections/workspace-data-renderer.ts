import { type AttributeDescriptor, type DataRendererRow, type DataRendererSettings, DiffBubble } from "@pstdio/ui";
import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createElement } from "react";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";
import { createDashboardWorkspaces, type DashboardWorkspaceRow, toWorkspaceRow } from "../data/dashboard-workspaces";
import {
  archiveWorkspaceResource,
  deleteWorkspaceResource,
  openRenameWorkspaceResource,
} from "../workspace-resource-actions";

const renderWorkspaceDiffOverview = (_value: unknown, row: DataRendererRow) => {
  const additions = row.attributes.diffAdditions;
  const deletions = row.attributes.diffDeletions;

  if (typeof additions !== "number" || typeof deletions !== "number") return null;

  return createElement(DiffBubble, { additions, deletions, variant: "ghost", size: "small", fileName: undefined });
};

const workspaceAttributes: AttributeDescriptor[] = [
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
    id: "diffOverview",
    label: "Diff",
    type: { kind: "string" },
    displayable: true,
    render: renderWorkspaceDiffOverview,
  },
];

const workspaceDefaultSettings: Partial<DataRendererSettings> = {
  viewMode: "list",
  columnGrouping: "none",
  rowGrouping: "none",
  ordering: { attributeId: "created", direction: "desc" },
  displayProperties: ["id", "type", "diffOverview"],
};

const subscribeWorkspaceData = (ctx: WorkbenchModuleContributionContext, listener: () => void) => {
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
const executeWorkspaceQuery = (ctx: WorkbenchModuleContributionContext) => {
  const workspaces = createDashboardWorkspaces(getDashboardSelectedProjectId(ctx));

  requestDashboardWorkspaceDiffSummaries(
    workspaces.filter((workspace) => workspace.type === "worktree").map((workspace) => workspace.id),
  );

  return workspaces.map(toWorkspaceRow);
};

export const registerWorkspaceDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer<DashboardWorkspaceRow>({
    id: dashboardWidgetIds.workspaces,
    title: "Workspaces",
    resourceKind: "workspace",
    attributes: workspaceAttributes,
    emptyTitle: "No workspaces yet",
    emptyDescription: "Create a workspace to start an isolated attempt for this project.",
    defaultSettings: workspaceDefaultSettings,
    subscribe: (listener) => subscribeWorkspaceData(ctx, listener),
    executeQuery: () => executeWorkspaceQuery(ctx),
    onRowClick: (row) => {
      void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
    getRowContextMenuActions: (row) => [
      // The default workspace (root repo) is permanent and cannot be renamed or deleted.
      ...(row.attributes.isDefault
        ? []
        : [
            {
              key: "rename-workspace",
              label: "Rename workspace",
              onClick: () => openRenameWorkspaceResource(ctx, row.resource),
            },
            {
              key: "archive-workspace",
              label: "Archive workspace",
              onClick: () => archiveWorkspaceResource(ctx, row.resource),
            },
            {
              key: "delete-workspace",
              label: "Delete workspace",
              onClick: () => deleteWorkspaceResource(ctx, row.resource),
            },
          ]),
    ],
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
