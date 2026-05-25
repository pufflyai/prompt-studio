import {
  type AttributeDescriptor,
  type AttributesSource,
  type DataRendererRow,
  type DataRendererSettings,
  DiffBubble,
} from "@pstdio/ui";
import i18n from "i18next";
import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createElement } from "react";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  requestDashboardWorkspaceDiffSummaries,
  subscribeDashboardWorkspaceDiffSummaries,
} from "@/shared/workspaces/workspace-diff-summary-data";
import { createWorkspaceRows, type DashboardWorkspaceRow } from "../data/dashboard-workspaces";
import {
  readWorkspaceStatusExtensionData,
  setWorkspaceStatusExtensionValue,
  type WorkspaceStatusReadModel,
} from "../data/workspace-status-extension";

type WorkspaceRendererContext = Pick<WorkbenchModuleContributionContext, "context">;

const workspaceStatusDataListeners = new Set<() => void>();

const notifyWorkspaceStatusDataChanged = () => {
  for (const listener of workspaceStatusDataListeners) listener();
};

const subscribeWorkspaceStatusData = (listener: () => void) => {
  workspaceStatusDataListeners.add(listener);
  return () => {
    workspaceStatusDataListeners.delete(listener);
  };
};

const createWorkspaceStatusStore = () => {
  let snapshot: WorkspaceStatusReadModel | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    setSnapshot: (next: WorkspaceStatusReadModel | null) => {
      snapshot = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const workspaceStatusStore = createWorkspaceStatusStore();
let workspaceAttributesSourceSnapshot: WorkspaceStatusReadModel | null | undefined;
let workspaceAttributesSnapshot: AttributeDescriptor[] | undefined;

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

const createWorkspaceStatusAttribute = (statusData: WorkspaceStatusReadModel): AttributeDescriptor => ({
  id: statusData.attribute.id,
  label: statusData.attribute.label,
  type: {
    kind: "enum",
    options: statusData.statuses
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((status) => ({
        value: status.id,
        label: status.label,
        color: status.color,
        icon: status.icon,
      })),
  },
  filterable: statusData.attribute.filterable,
  groupable: statusData.attribute.groupable,
  sortable: statusData.attribute.sortable,
  displayable: statusData.attribute.displayable,
  editable: statusData.attribute.editable,
});

export const createWorkspaceAttributes = (statusData?: WorkspaceStatusReadModel | null): AttributeDescriptor[] => {
  const attributes: AttributeDescriptor[] = [
    {
      id: "id",
      label: "Attempt",
      type: { kind: "string" },
      displayable: true,
    },
  ];

  if (statusData) attributes.push(createWorkspaceStatusAttribute(statusData));

  attributes.push(
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
  );

  return attributes;
};

export const subscribeWorkspaceAttributes = workspaceStatusStore.subscribe;

export const getWorkspaceAttributesSnapshot = () => {
  const statusSnapshot = workspaceStatusStore.getSnapshot();
  if (workspaceAttributesSnapshot && workspaceAttributesSourceSnapshot === statusSnapshot)
    return workspaceAttributesSnapshot;

  workspaceAttributesSourceSnapshot = statusSnapshot;
  workspaceAttributesSnapshot = createWorkspaceAttributes(statusSnapshot);
  return workspaceAttributesSnapshot;
};

const createWorkspaceAttributeSource = (): AttributesSource => ({
  subscribe: subscribeWorkspaceAttributes,
  getSnapshot: getWorkspaceAttributesSnapshot,
});

export const workspaceDefaultSettings: Partial<DataRendererSettings> = {
  viewMode: "board",
  columnGrouping: "none",
  rowGrouping: "none",
  ordering: { attributeId: "updated", direction: "desc" },
  displayProperties: ["id", "type", "diffOverview"],
};

export { createWorkspaceRows };

const workspaceResourceUriPrefix = "dashboard-workbench://workspace/";

const resolveWorkspaceIdFromRowId = (rowId: string) => rowId.replace(workspaceResourceUriPrefix, "");

export const resolveWorkspaceBoardColumnConfig = () => ({ canDragIn: true, canDragOut: true });

export const applyWorkspaceStatusData = (
  rows: DashboardWorkspaceRow[],
  statusData: WorkspaceStatusReadModel | null,
): DashboardWorkspaceRow[] => {
  if (!statusData) return rows;

  return rows.map((row) => {
    const workspaceId = row.resource.id ?? resolveWorkspaceIdFromRowId(row.id);
    const value = workspaceId ? statusData.valuesByWorkspaceId[workspaceId]?.status : undefined;
    if (!value) return row;
    return { ...row, attributes: { ...row.attributes, status: value } };
  });
};

export const createWorkspaceRowsWithStatusData = (
  projectId: string | undefined,
  statusData: WorkspaceStatusReadModel | null,
) => applyWorkspaceStatusData(createWorkspaceRows(projectId), statusData);

export const createWorkspaceRowsWithCurrentStatusData = (projectId: string | undefined) =>
  createWorkspaceRowsWithStatusData(projectId, workspaceStatusStore.getSnapshot());

export const updateWorkspaceStatusAttribute = async (input: {
  projectId: string | undefined;
  rowId: string;
  attributeId: string;
  value: unknown;
}) => {
  const { projectId, rowId, attributeId, value } = input;
  if (attributeId !== "status") return;

  await setWorkspaceStatusExtensionValue(projectId, resolveWorkspaceIdFromRowId(rowId), String(value));
  notifyWorkspaceStatusDataChanged();
};

const subscribeWorkspaceData = (ctx: WorkspaceRendererContext, listener: () => void) => {
  const unsubscribeDashboardData = subscribeDashboardData(listener);
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, listener);
  const unsubscribeDiffSummaries = subscribeDashboardWorkspaceDiffSummaries(listener);
  const unsubscribeExtensionMetadata = subscribeDashboardExtensionMetadata(listener);
  const unsubscribeWorkspaceStatusData = subscribeWorkspaceStatusData(listener);

  return () => {
    unsubscribeDashboardData();
    unsubscribeProject();
    unsubscribeDiffSummaries();
    unsubscribeExtensionMetadata();
    unsubscribeWorkspaceStatusData();
  };
};

const executeWorkspaceQuery = async (ctx: WorkbenchModuleContributionContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  const rows = createWorkspaceRows(getDashboardSelectedProjectId(ctx));
  const workspaceIds = rows
    .map((row) => row.resource.id)
    .filter((workspaceId): workspaceId is string => Boolean(workspaceId));

  requestDashboardWorkspaceDiffSummaries(
    rows
      .filter((row) => row.attributes.type === "worktree")
      .map((row) => row.resource.id)
      .filter((workspaceId): workspaceId is string => Boolean(workspaceId)),
  );

  const statusData = await readWorkspaceStatusExtensionData(projectId, workspaceIds);
  workspaceStatusStore.setSnapshot(statusData);
  return applyWorkspaceStatusData(rows, statusData);
};

export const registerWorkspaceDataRenderer = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerDataRenderer<DashboardWorkspaceRow>({
    id: dashboardWidgetIds.workspaces,
    title: "Workspaces",
    resourceKind: "workspace",
    attributes: createWorkspaceAttributeSource(),
    hideToolbar: true,
    emptyTitle: i18n.t("workspaces.empty.title"),
    emptyDescription: i18n.t("workspaces.empty.description"),
    defaultSettings: workspaceDefaultSettings,
    subscribe: (listener) => subscribeWorkspaceData(ctx, listener),
    executeQuery: () => executeWorkspaceQuery(ctx),
    getBoardColumnConfig: resolveWorkspaceBoardColumnConfig,
    onRowClick: (row) => {
      void ctx.resources.openResource(row.resource, { replaceActive: true });
    },
    onAttributeChange: (rowId, attributeId, value) => {
      void updateWorkspaceStatusAttribute({
        projectId: getDashboardSelectedProjectId(ctx),
        rowId,
        attributeId,
        value,
      }).catch((error) => {
        console.error("[move workspace]", error);
      });
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
