import { Box, HStack } from "@chakra-ui/react";
import { DataRendererToolbar } from "@pstdio/ui";
import type { WorkbenchWidgetPlacement } from "pstdio-workbench/core";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore, WorkbenchBreadcrumbView, WorkbenchHeaderActions } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import { getDashboardDataVersion, subscribeDashboardData } from "../../../data/dashboard-data";
import { dashboardWorkspaceMenuPath } from "../../../shared/menu-paths";
import { dashboardWidgetIds } from "../../../shared/widget-ids";
import {
  createWorkspaceRows,
  workspaceDefaultSettings,
  workspaceDisplayPropertyOptions,
  workspaceFilterCategories,
  workspaceGroupingOptions,
  workspaceOrderingOptions,
  workspaceTagDefinitions,
} from "../../workspaces/collections/workspace-data-renderer";

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

const resolveDataRendererStorageKey = (dataRendererId: string, placement: WorkbenchWidgetPlacement) =>
  `pstdio:workbench:dataRenderer:${dataRendererId}:${placement.widgetId}`;

const WorkspaceDataControls = (props: { input: WorkbenchWidgetRenderInput; placement: WorkbenchWidgetPlacement }) => {
  const { input, placement } = props;
  const selectedProjectId = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values["dashboard.project.id"],
  );
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);

  return (
    <DataRendererToolbar
      tickets={createWorkspaceRows(typeof selectedProjectId === "string" ? selectedProjectId : undefined)}
      storageKey={resolveDataRendererStorageKey(dashboardWidgetIds.workspaces, placement)}
      tagDefinitions={workspaceTagDefinitions}
      groupingOptions={workspaceGroupingOptions}
      orderingOptions={workspaceOrderingOptions}
      displayPropertyOptions={workspaceDisplayPropertyOptions}
      filterCategories={workspaceFilterCategories}
      defaultSettings={workspaceDefaultSettings}
      align="end"
    />
  );
};

const isWorkspaceDetail = (contributionId: string) =>
  contributionId === dashboardWidgetIds.workspaceChanges || contributionId === dashboardWidgetIds.workspaceChecks;

const DashboardHeaderControls = (props: { input: WorkbenchWidgetRenderInput; placement: WorkbenchWidgetPlacement }) => {
  const { input, placement } = props;

  if (placement.contributionId === dashboardWidgetIds.workspaces) {
    return <WorkspaceDataControls input={input} placement={placement} />;
  }

  if (isWorkspaceDetail(placement.contributionId)) {
    return <WorkbenchHeaderActions workbench={input.workbench} menuPath={dashboardWorkspaceMenuPath} />;
  }

  return null;
};

export const DashboardMainHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const mainArea = useWorkbenchStore(input.workbench.layout.store, (state) => state.layout.areas.main);
  const activePlacement = getActivePlacement(mainArea.widgets, mainArea.activeWidgetId);

  if (!activePlacement) return null;

  return (
    <HStack h="full" w="full" minW="0" gap="sm">
      <WorkbenchBreadcrumbView workbench={input.workbench} />
      <Box flex="1" minW="0" />
      <DashboardHeaderControls input={input} placement={activePlacement} />
    </HStack>
  );
};
