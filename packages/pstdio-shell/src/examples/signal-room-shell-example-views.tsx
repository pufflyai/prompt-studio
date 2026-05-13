import { Badge, Box, Button, Grid, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { ResourceRef } from "../core";
import { createShellRendererRegistry, ShellIcon, type ShellWidgetRenderInput } from "../react";
import {
  signalRoomChannels,
  signalRoomLanes,
  signalRoomLogRows,
  signalRoomQueueItems,
  signalRoomResources,
  signalRoomRunbookItems,
  signalRoomWidgetIds,
} from "./signal-room-shell-example-data";

const openResource = (input: ShellWidgetRenderInput, resource: ResourceRef) => {
  void input.shell.resources.openResource(resource).then(input.refresh);
};

const executeCommand = (input: ShellWidgetRenderInput, commandId: string) => {
  void input.shell.commands.executeCommand(commandId).then(input.refresh);
};

const ShellStrip = (props: { children: ReactNode }) => {
  const { children } = props;

  return (
    <HStack h="full" minW="0" overflow="hidden" px="sm" gap="sm">
      {children}
    </HStack>
  );
};

const TopBar = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const activityCount = input.shell.activity.listItems().length;

  return (
    <ShellStrip>
      <HStack gap="xs" flex="1" minW="0">
        <ShellIcon name="SatelliteDish" size={18} />
        <Text textStyle="label/S/medium" color="fg" truncate>
          Signal Room
        </Text>
        <Badge colorPalette="green" variant="subtle">
          Live
        </Badge>
      </HStack>
      <HStack gap="xs" flexShrink={0}>
        <Badge colorPalette="gray" variant="outline">
          {activityCount} events
        </Badge>
        <Button size="xs" variant="subtle" onClick={() => executeCommand(input, "signal-room.acknowledge")}>
          <ShellIcon name="CheckCheck" size={14} />
          Acknowledge
        </Button>
      </HStack>
    </ShellStrip>
  );
};

const ActivityRail = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Stack h="full" alignItems="center" py="sm" gap="sm">
      {signalRoomChannels.map((channel) => (
        <IconButton
          key={channel.id}
          aria-label={channel.label}
          size="sm"
          variant="ghost"
          onClick={() => openResource(input, channel.resource)}
        >
          <ShellIcon name={channel.icon} size={18} />
        </IconButton>
      ))}
    </Stack>
  );
};

const MainHeader = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;

  return (
    <ShellStrip>
      <HStack gap="xs" flex="1" minW="0">
        <Badge colorPalette="red" variant="subtle">
          Critical path
        </Badge>
        <Text textStyle="paragraph/S/regular" color="fg.muted" truncate>
          package smoke, extension review, release notes
        </Text>
      </HStack>
      <Button size="xs" variant="ghost" onClick={() => openResource(input, signalRoomResources.queue)}>
        <ShellIcon name="ArrowUpRight" size={14} />
        Queue
      </Button>
    </ShellStrip>
  );
};

const MetricCell = (props: { label: string; value: string; color: string; detail: string }) => {
  const { color, detail, label, value } = props;

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="sm" minW="0" p="sm">
      <HStack gap="xs" justifyContent="space-between" minW="0">
        <Text textStyle="label/XS/medium" color="fg.muted" truncate>
          {label}
        </Text>
        <Badge colorPalette={color} variant="subtle">
          {detail}
        </Badge>
      </HStack>
      <Text textStyle="heading/L" color="fg" mt="xs">
        {value}
      </Text>
    </Box>
  );
};

const FlowBoard = () => (
  <Box borderWidth="1px" borderColor="border.muted" borderRadius="sm" minW="0" overflow="hidden">
    <HStack borderBottomWidth="1px" borderColor="border.muted" minH="2.5rem" px="sm">
      <ShellIcon name="GitGraph" size={16} color="fg.muted" />
      <Text textStyle="label/S/medium" color="fg" flex="1" minW="0" truncate>
        Flow board
      </Text>
      <Badge colorPalette="gray" variant="outline">
        4 lanes
      </Badge>
    </HStack>
    <Grid templateColumns={{ base: "1fr", md: "repeat(4, minmax(0, 1fr))" }} gap="xs" p="sm">
      {["Intake", "Triage", "Repair", "Ship"].map((stage, index) => (
        <Stack key={stage} gap="xs" minW="0">
          <Text textStyle="label/XS/medium" color="fg.muted" truncate>
            {stage}
          </Text>
          <Box bg={index === 2 ? "red.subtle" : "bg.panel"} borderRadius="sm" minH="7rem" p="sm">
            <Text textStyle="paragraph/S/medium" color="fg" truncate>
              {signalRoomQueueItems[index % signalRoomQueueItems.length]?.id}
            </Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted" mt="xs">
              {signalRoomQueueItems[index % signalRoomQueueItems.length]?.title}
            </Text>
          </Box>
        </Stack>
      ))}
    </Grid>
  </Box>
);

const QueueCards = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Stack gap="sm" minW="0">
      {signalRoomQueueItems.map((item) => (
        <Box key={item.id} borderWidth="1px" borderColor="border.muted" borderRadius="sm" p="sm" minW="0">
          <HStack gap="xs" minW="0">
            <Badge colorPalette={item.color} variant="subtle">
              {item.id}
            </Badge>
            <Text textStyle="label/XS/regular" color="fg.muted" flexShrink={0}>
              {item.owner}
            </Text>
          </HStack>
          <Text textStyle="paragraph/S/medium" color="fg" mt="xs">
            {item.title}
          </Text>
        </Box>
      ))}
      <Button size="sm" variant="subtle" onClick={() => openResource(input, signalRoomResources.queue)}>
        <ShellIcon name="ListChecks" size={14} />
        Open queue
      </Button>
    </Stack>
  );
};

const SignalSurface = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid
        templateColumns={{ base: "1fr", xl: "minmax(0, 1.35fr) minmax(18rem, 0.65fr)" }}
        gap="md"
        w="full"
        alignItems="start"
      >
        <Stack gap="md" minW="0">
          <Grid templateColumns="repeat(auto-fit, minmax(9rem, 1fr))" gap="sm">
            {signalRoomLanes.map((lane) => (
              <MetricCell key={lane.label} {...lane} />
            ))}
          </Grid>
          <FlowBoard />
        </Stack>
        <QueueCards input={input} />
      </Grid>
    </ScrollArea>
  );
};

const QueueView = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="sm" w="full">
      {signalRoomQueueItems.map((item) => (
        <HStack key={item.id} borderWidth="1px" borderColor="border.muted" borderRadius="sm" gap="sm" p="sm" minW="0">
          <Badge colorPalette={item.color} variant="subtle">
            {item.id}
          </Badge>
          <Text textStyle="paragraph/S/medium" color="fg" flex="1" minW="0" truncate>
            {item.title}
          </Text>
          <Text textStyle="label/XS/regular" color="fg.muted" flexShrink={0}>
            {item.owner}
          </Text>
        </HStack>
      ))}
    </Stack>
  </ScrollArea>
);

const ContextPanel = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "sm" }}>
    <Stack gap="sm" w="full">
      <Text textStyle="label/S/medium" color="fg">
        Runbook
      </Text>
      {signalRoomRunbookItems.map((item) => (
        <HStack key={item.label} gap="xs" minW="0">
          <ShellIcon name="CircleDot" size={12} color="fg.muted" />
          <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
            {item.label}
          </Text>
          <Badge colorPalette={item.value === "blocked" ? "red" : "gray"} variant="subtle">
            {item.value}
          </Badge>
        </HStack>
      ))}
    </Stack>
  </ScrollArea>
);

const LogPanel = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "sm" }}>
    <Stack gap="xs" w="full">
      {signalRoomLogRows.map((row) => (
        <Grid key={`${row.time}-${row.label}`} templateColumns="4rem minmax(0, 1fr) 6rem" gap="xs" alignItems="center">
          <Text textStyle="label/XS/regular" color="fg.muted">
            {row.time}
          </Text>
          <Text textStyle="paragraph/S/regular" color="fg" truncate>
            {row.label}
          </Text>
          <Badge colorPalette={row.severity === "warning" ? "yellow" : "green"} variant="subtle">
            {row.severity}
          </Badge>
        </Grid>
      ))}
    </Stack>
  </ScrollArea>
);

const StatusBar = () => (
  <HStack h="full" minW="0" overflow="hidden" px="sm" gap="md">
    <Text textStyle="label/XS/medium" color="fg" truncate>
      Signal mesh online
    </Text>
    <Text textStyle="label/XS/regular" color="fg.muted" truncate>
      eu-north-1
    </Text>
    <Text textStyle="label/XS/regular" color="fg.muted" truncate>
      42ms
    </Text>
  </HStack>
);

const AssistantBubble = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="sm" w="full">
      <HStack gap="xs">
        <ShellIcon name="Bot" size={16} />
        <Text textStyle="label/S/medium" color="fg">
          Release copilot
        </Text>
      </HStack>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        SR-18 is the only item blocking the release lane.
      </Text>
    </Stack>
  </ScrollArea>
);

export const createSignalRoomRenderers = () =>
  createShellRendererRegistry([
    { id: signalRoomWidgetIds.top, render: (input) => <TopBar input={input} /> },
    { id: signalRoomWidgetIds.rail, render: (input) => <ActivityRail input={input} /> },
    { id: signalRoomWidgetIds.header, render: (input) => <MainHeader input={input} /> },
    { id: signalRoomWidgetIds.surface, render: (input) => <SignalSurface input={input} /> },
    { id: signalRoomWidgetIds.queue, render: () => <QueueView /> },
    { id: signalRoomWidgetIds.context, render: () => <ContextPanel /> },
    { id: signalRoomWidgetIds.log, render: () => <LogPanel /> },
    { id: signalRoomWidgetIds.status, render: () => <StatusBar /> },
    { id: signalRoomWidgetIds.assistant, render: () => <AssistantBubble /> },
  ]);
