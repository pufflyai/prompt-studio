import { Badge, Box, Flex, HStack, Text } from "@chakra-ui/react";
import { Breadcrumb, WorkspaceBadge } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchWidgetPlacement } from "../../../core";
import type { WorkbenchWidgetRenderInput } from "../../../react";
import { useWorkbenchStore, WorkbenchIcon } from "../../../react";
import { dashboardTickets, dashboardWidgetIds } from "../mock-data/data";
import { DashboardTicketControls } from "./dashboard-ticket-controls";

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

const BreadcrumbTitle = (props: { icon?: string; title: ReactNode }) => {
  const { icon, title } = props;

  return (
    <HStack as="span" gap="2xs" minW="0">
      {icon ? (
        <Text as="span" aria-hidden="true" color="fg.muted" display="inline-flex" flexShrink={0}>
          <WorkbenchIcon name={icon} size={14} />
        </Text>
      ) : null}
      <Text as="span" minW="0" truncate>
        {title}
      </Text>
    </HStack>
  );
};

const DashboardBreadcrumb = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const items = useWorkbenchStore(input.workbench.breadcrumbs.store, (state) => state.items) ?? [];

  if (items.length === 0) return null;

  return (
    <Breadcrumb
      items={items.map((item) => ({
        title: <BreadcrumbTitle icon={item.icon} title={item.title as ReactNode} />,
        url: item.url,
        onClick: item.onClick,
      }))}
      separator="/"
      separatorGap="xs"
      display="flex"
      h="full"
    />
  );
};

const TicketsControls = () => (
  <HStack gap="xs" flexShrink={0}>
    <Badge size="sm" variant="outline">
      {dashboardTickets.length}
    </Badge>
    <DashboardTicketControls />
  </HStack>
);

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
  } else if (activePlacement.contributionId === dashboardWidgetIds.tickets) {
    controls = <TicketsControls />;
  }

  return (
    <HStack h="full" w="full" minW="0" gap="sm">
      <DashboardBreadcrumb input={input} />
      <Box flex="1" minW="0" />
      {controls}
    </HStack>
  );
};
