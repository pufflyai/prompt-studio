import {
  type AttributeDescriptor,
  type DataRendererRow,
  type DataRendererSettings,
  DiffBubble,
  type EnumOptionsSource,
} from "@pstdio/ui";
import i18n from "i18next";
import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createElement } from "react";
import {
  createDashboardAttemptStatuses,
  createWorkspaceRows,
  type DashboardWorkspaceRow,
  subscribeDashboardData,
} from "../../../data/dashboard-data";
import {
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "../../../data/workspace-diff-summary-data";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "../../../shared/project-context";
import { dashboardWidgetIds } from "../../../shared/widget-ids";

type WorkspaceRendererContext = Pick<WorkbenchModuleContributionContext, "context">;

const createWorkspaceStatusSource = (ctx: WorkspaceRendererContext): EnumOptionsSource => ({
  subscribe: (listener) => subscribeWorkspaceData(ctx, listener),
  getSnapshot: () => createDashboardAttemptStatuses(getDashboardSelectedProjectId(ctx)),
});

const renderWorkspaceDiffOverview = (_value: unknown, row: DataRendererRow) => {
  const additions = row.attributes.diffAdditions;
  const deletions = row.attributes.diffDeletions;

  if (typeof additions !== "number" || typeof deletions !== "number") return null;

  return createElement(DiffBubble, {
    additions,
    deletions,
    variant: "ghost",
    size: "small",
    fileName: undefined,
  });
};

export const createWorkspaceAttributes = (ctx: WorkspaceRendererContext): AttributeDescriptor[] => [
  {
    id: "id",
    label: "Attempt",
    type: { kind: "string" },
    displayable: true,
  },
  {
    id: "status",
    label: "Status",
    type: { kind: "enum", options: createWorkspaceStatusSource(ctx) },
    filterable: true,
    groupable: true,
    displayable: true,
  },
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
    groupable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
  {
    id: "diffOverview",
    label: "Diff",
    type: { kind: "string" },
    displayable: true,
    render: renderWorkspaceDiffOverview,
  },
];

export const workspaceDefaultSettings: Partial<DataRendererSettings> = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "updated", direction: "desc" },
  displayProperties: ["id", "status", "type", "diffOverview"],
};

export { createWorkspaceRows };

const subscribeWorkspaceData = (ctx: WorkspaceRendererContext, listener: () => void) => {
  const unsubscribeDashboardData = subscribeDashboardData(listener);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, listener);
  const unsubscribeDiffSummaries = subscribeDashboardWorkspaceDiffSummaries(listener);

  return () => {
    unsubscribeDashboardData();
    unsubscribeProject();
    unsubscribeDiffSummaries();
  };
};

const executeWorkspaceQuery = (ctx: WorkbenchModuleContributionContext) => {
  const rows = createWorkspaceRows(getDashboardSelectedProjectId(ctx));
  requestDashboardWorkspaceDiffSummaries(
    rows
      .filter((row) => row.attributes.type === "worktree")
      .map((row) => row.resource.id)
      .filter((workspaceId): workspaceId is string => Boolean(workspaceId)),
  );
  return rows;
};

export const registerWorkspaceDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer<DashboardWorkspaceRow>({
    id: dashboardWidgetIds.workspaces,
    title: "Workspaces",
    resourceKind: "workspace",
    attributes: createWorkspaceAttributes(ctx),
    hideToolbar: true,
    emptyTitle: i18n.t("workspaces.empty.title"),
    emptyDescription: i18n.t("workspaces.empty.description"),
    defaultSettings: workspaceDefaultSettings,
    subscribe: (listener) => subscribeWorkspaceData(ctx, listener),
    executeQuery: () => executeWorkspaceQuery(ctx),
    onRowClick: (row) => {
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
