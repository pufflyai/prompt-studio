import { Box, Button, Icon, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import {
  ListRow,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  ScrollArea,
  type SessionCompletionStatus,
  SessionIndicator,
  Tooltip,
} from "@pstdio/ui";
import type { WorkbenchWidgetPlacement } from "@pstdio/workbench/core";
import type { WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { ArrowUpRight, ChevronDown, MessageCircle, PenBox } from "lucide-react";
import { Fragment, useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import {
  createDashboardSessions,
  type DashboardSession,
  resolveDashboardSessionViewForPlacement,
} from "../data/dashboard-sessions";
import { buildSessionBubbleGroups } from "./session-bubble-groups";

const sessionDropdownLimit = 6;

const getActivePlacement = (widgets: WorkbenchWidgetPlacement[], activeWidgetId?: string) =>
  widgets.find((placement) => placement.widgetId === activeWidgetId) ?? widgets[0];

const createWorkspaceResource = (input: {
  workspaceId: string | null;
  workspaceTitle: string;
  workspaceShorthand: string;
  workspaceBranch: string | null;
  projectId: string | undefined;
}) => {
  if (!input.workspaceId) return undefined;

  return createDashboardResource(
    "workspace",
    input.workspaceId,
    input.workspaceTitle || input.workspaceShorthand || "Workspace",
    "GitBranch",
    input.projectId,
    {
      workspaceId: input.workspaceId,
      ...(input.workspaceBranch ? { workspaceBranch: input.workspaceBranch } : {}),
      ...(input.workspaceShorthand ? { workspaceShorthand: input.workspaceShorthand } : {}),
    },
  );
};

const getWorkspaceResource = (input: {
  activeMainPlacement: WorkbenchWidgetPlacement | undefined;
  headerPlacement: WorkbenchWidgetPlacement;
  projectId: string | undefined;
}) => {
  const activeResource = input.activeMainPlacement?.resource;
  if (activeResource?.kind === "workspace") return activeResource;

  const view = resolveDashboardSessionViewForPlacement(input.headerPlacement);
  return createWorkspaceResource({
    workspaceId: view.workspaceId,
    workspaceTitle: view.workspaceTitle,
    workspaceShorthand: view.workspaceShorthand,
    workspaceBranch: view.workspaceBranch,
    projectId: input.projectId,
  });
};

const getSessionStatus = (input: {
  selectedSessionStatus: string | undefined;
  placement: WorkbenchWidgetPlacement;
}) => {
  if (input.selectedSessionStatus) return input.selectedSessionStatus as SessionCompletionStatus;

  const status = input.placement.resource?.metadata?.status;
  return typeof status === "string" ? (status as SessionCompletionStatus) : undefined;
};

const SessionMenuButton = (props: { label: string; status: SessionCompletionStatus | undefined }) => {
  const { label, status } = props;

  return (
    <Button variant="ghost" size="sm" px="2" maxW="10rem" minW="0" aria-label="Select session">
      <SessionIndicator status={status} />
      <Text textStyle="label/XS/medium" color="fg" lineClamp={1} ml="2xs" minW="0" textAlign="left">
        {label}
      </Text>
      <ChevronDown size={14} />
    </Button>
  );
};

const SessionMenuRow = (props: { session: DashboardSession; isSelected: boolean; onSelect: () => void }) => {
  const { session, isSelected, onSelect } = props;

  return (
    <Menu.Item value={session.id} asChild>
      <ListRow
        asChild
        variant="compact"
        id={session.id}
        label={session.title}
        tooltip={session.title}
        icon={<Icon as={resolveSessionIndicatorIcon(session.status as SessionCompletionStatus)} boxSize="16px" />}
        iconColor={resolveSessionIndicatorColor(session.status as SessionCompletionStatus)}
        isSelected={isSelected}
        onActivate={onSelect}
      />
    </Menu.Item>
  );
};

export const SessionBubbleHeader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const mainArea = useWorkbenchStore(input.workbench.layout.store, (state) => state.layout.areas.main);
  const view = resolveDashboardSessionViewForPlacement(input.placement);
  const sessions = createDashboardSessions(projectId);
  const selectedSession = sessions.find((session) => session.id === view.sessionId);
  const selectedLabel = selectedSession?.title ?? input.placement.resource?.label ?? "New session";
  const selectedStatus = getSessionStatus({
    selectedSessionStatus: selectedSession?.status,
    placement: input.placement,
  });
  const workspace = getWorkspaceResource({
    activeMainPlacement: getActivePlacement(mainArea.widgets, mainArea.activeWidgetId),
    headerPlacement: input.placement,
    projectId,
  });
  const sessionGroups = buildSessionBubbleGroups({
    sessions,
    workspaceId: workspace?.id,
    workspaceLabel: workspace?.label,
    limit: sessionDropdownLimit,
  });

  return (
    <Box display="flex" alignItems="center" gap="1" minW="0" w="full" h="full">
      <Menu.Root>
        <Menu.Trigger asChild>
          <Box minW="0">
            <Tooltip content="Select session">
              <SessionMenuButton label={selectedLabel} status={selectedStatus} />
            </Tooltip>
          </Box>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="13.75rem" maxW="26.25rem" bg="bg" zIndex="popover">
              <ScrollArea maxH="14rem" data-testid="session-bubble-session-options">
                {sessionGroups.length > 0 ? (
                  sessionGroups.map((group, index) => (
                    <Fragment key={group.id}>
                      {index > 0 ? <Menu.Separator /> : null}
                      <Menu.ItemGroup>
                        {group.label ? (
                          <Menu.ItemGroupLabel textStyle="label/XS/medium" color="fg.muted" px="sm" py="2xs">
                            {group.label}
                          </Menu.ItemGroupLabel>
                        ) : null}
                        {group.sessions.map((session) => (
                          <SessionMenuRow
                            key={session.id}
                            session={session}
                            isSelected={session.id === view.sessionId}
                            onSelect={() => {
                              void input.workbench.commands.executeCommand(dashboardCommandIds.openFloatingSession, {
                                resource: session.resource,
                              });
                            }}
                          />
                        ))}
                      </Menu.ItemGroup>
                    </Fragment>
                  ))
                ) : (
                  <Menu.Item value="empty" asChild>
                    <ListRow
                      asChild
                      variant="compact"
                      id="empty"
                      label="No sessions yet"
                      icon={<Icon as={MessageCircle} boxSize="16px" />}
                      disabled
                    />
                  </Menu.Item>
                )}
              </ScrollArea>
              <Menu.Separator />
              <Menu.Item value="view-more" asChild>
                <ListRow
                  asChild
                  variant="compact"
                  id="view-more"
                  label="View more sessions"
                  endContent={<Icon as={ArrowUpRight} boxSize="16px" />}
                  onActivate={() => {
                    void input.workbench.commands.executeCommand(dashboardCommandIds.openSessions);
                  }}
                />
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      <Tooltip content="New session">
        <IconButton
          size="xs"
          variant="ghost"
          aria-label="New session"
          onClick={() => {
            void input.workbench.commands.executeCommand(dashboardCommandIds.createSession, {
              ...(workspace ? { workspace } : {}),
            });
          }}
        >
          <PenBox size={14} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
