import { Box, Flex, HStack } from "@chakra-ui/react";
import { Breadcrumb, WorkspaceBadge } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchWidgetPlacement } from "../../../core";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import { useWorkbenchStore } from "../../../react";
import { buildWorkbenchBreadcrumbItems } from "../../../react/workbench/workbench-breadcrumbs";
import { dashboardTickets, dashboardWidgetIds } from "../mock-data/data";

type DashboardTicket = (typeof dashboardTickets)[number];

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

const resolveTicket = (placement: WorkbenchWidgetPlacement | undefined) => {
  const resourceId = placement?.resource?.id;
  return dashboardTickets.find((ticket) => ticket.id === resourceId) ?? dashboardTickets[0];
};

const toSessionStatus = (status: string) => {
  if (
    status === "in_progress" ||
    status === "awaiting_input" ||
    status === "queued" ||
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "disconnected"
  ) {
    return status;
  }

  return undefined;
};

const DashboardBreadcrumb = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const items = useWorkbenchStore(input.workbench.breadcrumbs.store, (state) => state.items) ?? [];

  if (items.length === 0) return null;

  return (
    <Breadcrumb
      items={buildWorkbenchBreadcrumbItems(input.workbench)}
      separator="/"
      separatorGap="xs"
      display="flex"
      h="full"
    />
  );
};

const WorkspaceControls = (props: { ticket: DashboardTicket }) => {
  const { ticket } = props;

  return (
    <Flex align="center" gap="sm" minW="0" flexShrink={0}>
      <WorkspaceBadge
        workspaceType={ticket.workspace.type === "worktree" ? "worktree" : "current_branch"}
        shorthand={ticket.workspace.shorthand}
        attemptStatus={ticket.workspace.status}
        sessionStatus={toSessionStatus(ticket.workspace.sessionStatus)}
        diffAdditions={ticket.workspace.additions}
        diffDeletions={ticket.workspace.deletions}
        hasMultipleWorkspaces
      />
    </Flex>
  );
};

export const DashboardMainHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const mainArea = useWorkbenchStore(input.workbench.layout.store, (state) => state.layout.areas.main);
  const activePlacement = getActivePlacement(mainArea.widgets, mainArea.activeWidgetId);

  if (!activePlacement) return null;

  let controls: ReactNode = null;
  if (
    activePlacement.contributionId === dashboardWidgetIds.workspace ||
    activePlacement.contributionId === dashboardWidgetIds.workspacePage
  ) {
    controls = <WorkspaceControls ticket={resolveTicket(activePlacement)} />;
  }
  // Tickets widget controls (display/filter/saved-view) live inside the
  // WorkbenchDataView header now; no main-header pass-through needed.

  return (
    <HStack h="full" w="full" minW="0" gap="sm">
      <DashboardBreadcrumb input={input} />
      <Box flex="1" minW="0" />
      {controls}
    </HStack>
  );
};
