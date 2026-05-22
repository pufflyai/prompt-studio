import { Box, Button, Icon, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import {
  ListRow,
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  type SessionCompletionStatus,
  SessionIndicator,
  Tooltip,
} from "@pstdio/ui";
import { ChevronDown, PenBox } from "lucide-react";
import { useWorkbenchStore, type WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { dashboardWidgetIds } from "../../../shared/widget-ids";
import { dashboardSessions } from "../mock-data/sessions";

interface DashboardSessionSelectorProps {
  input: WorkbenchWidgetRenderInput;
}

export const DashboardSessionSelector = (props: DashboardSessionSelectorProps) => {
  const { input } = props;

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
  const selectedSession = dashboardSessions.find((session) => session.id === activeSessionId);
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
              <Box maxH="14rem" overflowY="auto" py="1">
                {dashboardSessions.map((session) => (
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
                        input.workbench.layout.openWidget(dashboardWidgetIds.sessionBubble, {
                          pinned: true,
                          resource: session.resource,
                          title: session.title,
                        });
                      }}
                    />
                  </Menu.Item>
                ))}
              </Box>
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
            input.workbench.notifications.show({ level: "info", title: "Session draft created" });
          }}
        >
          <PenBox size={16} />
        </IconButton>
      </Tooltip>
    </>
  );
};
