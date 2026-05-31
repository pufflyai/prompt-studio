import { Button, Icon, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import {
  ListRow,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  ScrollArea,
  type SessionCompletionStatus,
  SessionIndicator,
  Tooltip,
} from "@pstdio/ui";
import { ArrowUpRight, ChevronDown, PenBox } from "lucide-react";
import { useWorkbenchStore, type WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useSyncExternalStore } from "react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardSessions } from "../data/dashboard-sessions";
import { getRecentDashboardSessions } from "../data/recent-dashboard-sessions";

const sessionDropdownLimit = 6;

interface DashboardSessionSelectorProps {
  input: WorkbenchWidgetRenderInput;
}

export const DashboardSessionSelector = (props: DashboardSessionSelectorProps) => {
  const { input } = props;
  useSyncExternalStore(subscribeDashboardData, getDashboardDataVersion, getDashboardDataVersion);
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const sessions = createDashboardSessions(projectId);
  const recentSessions = getRecentDashboardSessions(sessions, sessionDropdownLimit);

  // The selector lives in the bubble header, but the active session is carried
  // by the separate bubble widget's placement. Reading it from the live layout
  // keeps the dropdown in sync no matter how the session was switched.
  const activeSessionId = useWorkbenchStore(
    input.workbench.layout.store,
    (state) =>
      Object.values(state.layout.areas)
        .flatMap((area) => area.widgets)
        .find((widget) => widget.contributionId === dashboardWidgetIds.sessionBubble)?.resource?.id,
  );
  const selectedSession = sessions.find((session) => session.id === activeSessionId);
  const label = selectedSession?.title ?? "New session";
  const selectedStatus = selectedSession?.status as SessionCompletionStatus | undefined;

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button variant="ghost" size="sm" px="2" maxW="10rem">
            <SessionIndicator status={selectedStatus} />
            <Text textStyle="label/XS/medium" color="fg" lineClamp={1} ml="2xs" textAlign="left">
              {label}
            </Text>
            <ChevronDown size={14} />
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="220px" maxW="420px" bg="bg">
              <ScrollArea maxH="14rem" contentProps={{ py: "1" }}>
                {recentSessions.length > 0 ? (
                  recentSessions.map((session) => (
                    <Menu.Item key={session.id} value={session.id} asChild>
                      <ListRow
                        asChild
                        variant="compact"
                        id={session.id}
                        label={session.title}
                        tooltip={session.title}
                        icon={
                          <Icon
                            as={resolveSessionIndicatorIcon(session.status as SessionCompletionStatus)}
                            boxSize="16px"
                          />
                        }
                        iconColor={resolveSessionIndicatorColor(session.status as SessionCompletionStatus)}
                        isSelected={session.id === activeSessionId}
                        onActivate={() => {
                          input.workbench.commands.executeCommand(dashboardCommandIds.openFloatingSession, {
                            resource: session.resource,
                          });
                        }}
                      />
                    </Menu.Item>
                  ))
                ) : (
                  <Menu.Item value="empty" asChild>
                    <ListRow asChild variant="compact" id="empty" label="No sessions yet" disabled />
                  </Menu.Item>
                )}
              </ScrollArea>
              <Menu.Separator />
              <Menu.Item value="open-all-sessions" asChild>
                <ListRow
                  asChild
                  variant="compact"
                  id="open-all-sessions"
                  label="Open all sessions"
                  endContent={<Icon as={ArrowUpRight} boxSize="16px" />}
                  onActivate={() => {
                    input.workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });
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
            input.workbench.commands.executeCommand(dashboardCommandIds.createSession);
          }}
        >
          <PenBox size={16} />
        </IconButton>
      </Tooltip>
    </>
  );
};
