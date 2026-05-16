import { Avatar, Badge, Box, Button, Flex, HStack, IconButton, Menu, Portal, Stack, Text } from "@chakra-ui/react";
import { ListRow, ScrollArea } from "@pstdio/ui";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import { ChevronDown } from "lucide-react";
import type { WorkbenchCore, WorkbenchModuleContributionContext } from "../../../core";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import { dashboardMockChatMessages, dashboardTickets, dashboardWidgetIds } from "../mock-data/data";

const SlotChip = (props: { slotId: string }) => {
  const { slotId } = props;

  return (
    <Text textStyle="paragraph/XS/regular" color="fg.muted" fontFamily="mono" flexShrink={0}>
      {slotId}
    </Text>
  );
};

const WebviewPlaceholder = (props: {
  slotId: string;
  title: string;
  contributor: string;
  entry: string;
  icon: string;
  height?: string;
}) => {
  const { contributor, entry, height, icon, slotId, title } = props;

  return (
    <Stack
      gap="0"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.emphasis"
      borderRadius="sm"
      bg="bg.subtle"
      h={height}
      minH="0"
      overflow="hidden"
    >
      <HStack px="sm" py="2xs" borderBottomWidth="1px" borderColor="border.muted" bg="bg" gap="xs">
        <Text textStyle="label/S/medium" flex="1" minW="0" truncate>
          {title}
        </Text>
        <Badge size="xs" variant="outline">
          {contributor}
        </Badge>
        <SlotChip slotId={slotId} />
      </HStack>
      <Flex flex="1" minH="0" align="center" justify="center" direction="column" gap="2xs" p="md">
        <WorkbenchIcon name={icon} size={24} color="fg.muted" />
        <Text textStyle="paragraph/XS/regular" color="fg.muted" fontFamily="mono">
          iframe: {entry}
        </Text>
      </Flex>
    </Stack>
  );
};

interface DashboardLeftHeaderProps {
  workbench: WorkbenchCore;
}

export const DashboardLeftHeader = (props: DashboardLeftHeaderProps) => {
  const { workbench } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" width="full" justifyContent="flex-start" px="xs">
          <HStack gap="xs" minW="0" flex="1">
            <Avatar.Root size="2xs" flexShrink={0}>
              <Avatar.Fallback name="Acme" />
            </Avatar.Root>
            <Text textStyle="label/M/medium" truncate>
              Acme
            </Text>
          </HStack>
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="240px" bg="bg">
            <Menu.Item value="projects" asChild>
              <ListRow
                asChild
                variant="compact"
                id="projects"
                label="Projects"
                icon={<WorkbenchIcon name="FolderGit2" size={16} />}
                onActivate={() => workbench.notifications.show({ level: "info", title: "Project switcher opened" })}
              />
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

const TicketsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const activeTicketId = input.placement.resource?.kind === "ticket" ? input.placement.resource.id : undefined;

  return (
    <Stack h="full" minH="0" gap="0">
      <HStack px="sm" py="xs" borderBottomWidth="1px" borderColor="border.muted" gap="sm">
        <Text textStyle="label/M/medium">All tickets</Text>
        <Badge size="sm" variant="outline">
          {dashboardTickets.length}
        </Badge>
        <Box flex="1" />
        <Button size="xs" variant="outline">
          <WorkbenchIcon name="Plus" />
          New ticket
        </Button>
      </HStack>
      <ScrollArea flex="1" minH="0">
        {dashboardTickets.map((ticket) => (
          <HStack
            key={ticket.id}
            px="sm"
            py="xs"
            borderBottomWidth="1px"
            borderColor="border.muted"
            gap="sm"
            bg={activeTicketId === ticket.id ? "bg.muted" : "bg"}
            _hover={{ bg: "bg.muted" }}
          >
            <Text textStyle="label/S/medium" color="fg.muted" minW="64px" fontFamily="mono">
              {ticket.id}
            </Text>
            <Text textStyle="paragraph/S/regular" flex="1" minW="0" truncate>
              {ticket.title}
            </Text>
            <Badge size="sm" variant="outline">
              {ticket.status}
            </Badge>
            <IconButton
              aria-label={`Open ${ticket.id}`}
              size="xs"
              variant="ghost"
              onClick={() => {
                void input.workbench.resources.openResource(ticket.resource).then(input.refresh);
              }}
            >
              <WorkbenchIcon name="ExternalLink" size={14} />
            </IconButton>
          </HStack>
        ))}
      </ScrollArea>
    </Stack>
  );
};

const ExtensionRouteWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const routeId = input.placement.resource?.id ?? "repo-health";
  const title = input.placement.resource?.label ?? "Repo health";
  const entry = routeId === "changelog" ? "changelog.tsx" : routeId === "lab" ? "lab.tsx" : "health-page.tsx";

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="routes[].webview"
        title={`/projects/acme/extensions/${routeId}`}
        contributor={title === "Lab" ? "extension-lab" : "repo-health"}
        entry={entry}
        icon={input.placement.resource?.icon ?? "PanelLeft"}
        height="100%"
      />
    </Box>
  );
};

const SettingsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const title = input.placement.resource?.label ?? "Project settings";
  const isExtensionSettings = input.placement.resource?.id?.startsWith("settings/lab") === true;

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="project.settingsPanels.webview"
        title={title}
        contributor={isExtensionSettings ? "extension-lab" : "pstdio"}
        entry={isExtensionSettings ? "lab-settings.tsx" : "project-settings.tsx"}
        icon={input.placement.resource?.icon ?? "Settings"}
        height="100%"
      />
    </Box>
  );
};

const StatusWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <HStack h="full" gap="md" px="sm" minW="0">
      <HStack gap="xs">
        <WorkbenchIcon name="KanbanSquare" size={13} />
        <Text textStyle="label/XS/regular">{dashboardTickets.length} tickets</Text>
      </HStack>
      <HStack gap="xs">
        <WorkbenchIcon name="Puzzle" size={13} />
        <Text textStyle="label/XS/regular">{input.workbench.commands.listCommands().length} commands</Text>
      </HStack>
      <Box flex="1" />
      <Text textStyle="label/XS/regular" color="fg.muted" truncate>
        dashboard-workbench story
      </Text>
    </HStack>
  );
};

const SessionWidget = () => (
  <ChatPanel
    conversationKey="dashboard-workbench-session"
    messages={dashboardMockChatMessages}
    emptyStateTitle="No messages yet"
    emptyStateDescription="Start the conversation."
    chatInputPlaceholder="Reply to the agent..."
  />
);

export const registerDashboardWorkbenchRenderers = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.tickets,
    render: (input) => <TicketsWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.extensionRoute,
    render: (input) => <ExtensionRouteWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.settings,
    render: (input) => <SettingsWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.status,
    render: (input) => <StatusWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.session,
    render: () => <SessionWidget />,
  });
};
