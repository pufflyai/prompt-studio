import { DataRendererToolbar } from "@pstdio/ui";
import type { WorkbenchWidgetPlacement } from "pstdio-workbench/core";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore, WorkbenchHeaderActions } from "pstdio-workbench/react";
import { useState, useSyncExternalStore } from "react";
import { getDashboardDataVersion, subscribeDashboardData } from "../../../shared/data/dashboard-rows";
import { dashboardWorkspaceMenuPath } from "../../../shared/menu-paths";
import { dashboardWidgetIds } from "../../../shared/widget-ids";
import {
  createWorkspaceAttributes,
  createWorkspaceRows,
  workspaceDefaultSettings,
} from "../collections/workspace-data-renderer";

const resolveDataRendererStorageKey = (dataRendererId: string, placement: WorkbenchWidgetPlacement) =>
  `pstdio:workbench:dataRenderer:${dataRendererId}:${placement.widgetId}`;

const WorkspaceDataControls = (props: { input: WorkbenchWidgetRenderInput; placement: WorkbenchWidgetPlacement }) => {
  const { input, placement } = props;
  const selectedProjectId = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values["dashboard.project.id"],
  );
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const [attributes] = useState(() => createWorkspaceAttributes(input.workbench));

  return (
    <DataRendererToolbar
      rows={createWorkspaceRows(typeof selectedProjectId === "string" ? selectedProjectId : undefined)}
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
