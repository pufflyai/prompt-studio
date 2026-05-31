import { DataRendererToolbar } from "@pstdio/ui";
import type { WorkbenchWidgetPlacement } from "pstdio-workbench/core";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore, WorkbenchHeaderActions } from "pstdio-workbench/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { dashboardWorkspaceMenuPath } from "@/shared/app/menu-paths";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  applyWorkspaceStatusData,
  createWorkspaceRows,
  getWorkspaceAttributesSnapshot,
  subscribeWorkspaceAttributes,
  workspaceDefaultSettings,
} from "../collections/workspace-data-renderer";
import { readWorkspaceStatusExtensionData, type WorkspaceStatusReadModel } from "../data/workspace-status-extension";

const resolveDataRendererStorageKey = (dataRendererId: string, placement: WorkbenchWidgetPlacement) =>
  `pstdio:workbench:dataRenderer:${dataRendererId}:${placement.widgetId}`;

const WorkspaceDataControls = (props: { input: WorkbenchWidgetRenderInput; placement: WorkbenchWidgetPlacement }) => {
  const { input, placement } = props;
  const selectedProjectId = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values["dashboard.project.id"],
  );
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const attributes = useSyncExternalStore(
    subscribeWorkspaceAttributes,
    getWorkspaceAttributesSnapshot,
    getWorkspaceAttributesSnapshot,
  );
  const projectId = typeof selectedProjectId === "string" ? selectedProjectId : undefined;
  const baseRows = createWorkspaceRows(projectId);
  const workspaceIds = baseRows.map((row) => row.resource.id).filter((id): id is string => Boolean(id));
  const workspaceIdsKey = workspaceIds.join("\0");
  const [statusData, setStatusData] = useState<WorkspaceStatusReadModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    const currentWorkspaceIds = workspaceIdsKey.length > 0 ? workspaceIdsKey.split("\0") : [];

    readWorkspaceStatusExtensionData(projectId, currentWorkspaceIds).then((nextStatusData) => {
      if (!cancelled) setStatusData(nextStatusData);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceIdsKey]);

  return (
    <DataRendererToolbar
      rows={applyWorkspaceStatusData(baseRows, statusData)}
      storageKey={resolveDataRendererStorageKey(dashboardWidgetIds.workspaces, placement)}
      attributes={attributes}
      defaultSettings={workspaceDefaultSettings}
      align="end"
    />
  );
};

export const isWorkspaceHeaderPlacement = (placement: WorkbenchWidgetPlacement) =>
  placement.contributionId === dashboardWidgetIds.workspaces ||
  placement.contributionId === dashboardWidgetIds.workspaceChanges ||
  placement.contributionId === dashboardWidgetIds.workspaceChecks;

export const WorkspaceHeaderControls = (props: {
  input: WorkbenchWidgetRenderInput;
  placement: WorkbenchWidgetPlacement;
}) => {
  const { input, placement } = props;

  if (placement.contributionId === dashboardWidgetIds.workspaces) {
    return <WorkspaceDataControls input={input} placement={placement} />;
  }

  return <WorkbenchHeaderActions workbench={input.workbench} menuPath={dashboardWorkspaceMenuPath} />;
};
