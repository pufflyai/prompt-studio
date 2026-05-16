import { Badge, Box, Button, Code, Grid, HStack, Kbd, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { WorkbenchModuleContributionContext } from "../../../core";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import {
  commandPaletteMenuPath,
  resourceContextMenuPath,
  workbenchExampleTickets,
  workbenchLifecyclePhases,
  workbenchPreferenceNames,
  workbenchWidgetIds,
} from "../mock-data/data";
import { Metric, Panel, Row } from "./panel";

interface WidgetProps {
  input: WorkbenchWidgetRenderInput;
}

interface OverviewWidgetProps extends WidgetProps {
  rendererIds: string[];
}

const openCommand = (input: WorkbenchWidgetRenderInput, commandId: string, args?: unknown) => {
  void input.workbench.commands.executeCommand(commandId, args).then(input.refresh);
};

const OverviewWidget = (props: OverviewWidgetProps) => {
  const { input, rendererIds } = props;
  const { workbench } = input;
  const menuActionCount =
    workbench.menus.listMenuActions(commandPaletteMenuPath).length +
    workbench.menus.listMenuActions(resourceContextMenuPath).length;
  const metrics = [
    { label: "Commands", value: workbench.commands.listCommands().length },
    { label: "Menu actions", value: menuActionCount },
    { label: "Resource kinds", value: workbench.resources.listKinds().length },
    { label: "Tree views", value: workbench.trees.listTreeViews().length },
    { label: "React renderers", value: rendererIds.length },
    { label: "Notifications", value: workbench.notifications.listNotifications().length },
  ];

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="md" w="full">
        <Grid templateColumns="repeat(auto-fit, minmax(8rem, 1fr))" gap="sm">
          {metrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </Grid>
        <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md">
          <Panel
            title="Project commands"
            action={
              <Button size="xs" variant="subtle" onClick={() => openCommand(input, "project.runChecks")}>
                <WorkbenchIcon name="Play" />
                Run
              </Button>
            }
          >
            <Stack gap="2xs">
              {workbench.commands.listCommands().map((record) => (
                <Row
                  key={record.command.id}
                  icon={record.command.icon}
                  label={record.command.label}
                  value={record.command.category}
                />
              ))}
            </Stack>
          </Panel>
          <Panel title="Registry-backed state">
            <Stack gap="2xs">
              <Row icon="Bell" label="Notifications" value={workbench.notifications.listNotifications().length} />
              <Row
                icon="Keyboard"
                label="Active keybindings"
                value={workbench.keybindings.listActiveKeybindings().length}
              />
              <Row icon="PanelTop" label="Lifecycle hooks" value={workbenchLifecyclePhases.join(", ")} />
              {workbench.resources.listKinds().map((kind) => (
                <Row key={kind.kind} icon={kind.icon} label={kind.label} value={kind.ownerId} />
              ))}
            </Stack>
          </Panel>
        </Grid>
      </Stack>
    </ScrollArea>
  );
};

const TicketsWidget = (props: WidgetProps) => {
  const { input } = props;

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", lg: "repeat(3, minmax(0, 1fr))" }} gap="md" w="full" alignItems="start">
        {["In progress", "Ready", "Done"].map((status) => (
          <Panel key={status} title={status}>
            <Stack gap="sm">
              {workbenchExampleTickets
                .filter((ticket) => ticket.status === status)
                .map((ticket) => (
                  <Box key={ticket.id} borderWidth="1px" borderColor="border.muted" borderRadius="sm" p="sm">
                    <HStack gap="xs" alignItems="flex-start">
                      <Badge variant="subtle" colorPalette={ticket.severity === "warning" ? "yellow" : "gray"}>
                        {ticket.id}
                      </Badge>
                      <Text textStyle="paragraph/S/medium" color="fg" flex="1" minW="0">
                        {ticket.title}
                      </Text>
                    </HStack>
                    <Button
                      mt="sm"
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        void input.workbench.resources.openResource(ticket.resource).then(input.refresh);
                      }}
                    >
                      <WorkbenchIcon name="ExternalLink" />
                      Open
                    </Button>
                  </Box>
                ))}
            </Stack>
          </Panel>
        ))}
      </Grid>
    </ScrollArea>
  );
};

const WorkspaceWidget = (props: WidgetProps) => {
  const { input } = props;
  const activeKeybindings = input.workbench.keybindings.listActiveKeybindings();

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md" w="full">
        <Panel title="Workspace resources">
          <Stack gap="2xs">
            {input.workbench.resources.listKinds().map((kind) => (
              <Row key={kind.kind} icon={kind.icon} label={kind.kind} value={kind.label} />
            ))}
          </Stack>
        </Panel>
        <Panel title="Active keybindings">
          <Stack gap="xs">
            {activeKeybindings.map((keybinding) => {
              const command = input.workbench.commands.getCommand(keybinding.commandId)?.command;
              return (
                <HStack key={`${keybinding.commandId}-${keybinding.keybinding}`} gap="xs" minW="0">
                  <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
                    {command?.label ?? keybinding.commandId}
                  </Text>
                  <Kbd>{keybinding.keybinding}</Kbd>
                </HStack>
              );
            })}
          </Stack>
        </Panel>
      </Grid>
    </ScrollArea>
  );
};

const SettingsWidget = (props: WidgetProps) => {
  const { input } = props;
  const contextEntries = Object.entries(input.workbench.context.snapshot());

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md" w="full">
        <Panel title="Preferences">
          <Stack gap="2xs">
            {workbenchPreferenceNames.map((name) => (
              <Row
                key={name}
                icon="SlidersHorizontal"
                label={name}
                value={String(input.workbench.preferences.getValue(name))}
              />
            ))}
          </Stack>
        </Panel>
        <Panel title="Context keys">
          <Stack gap="2xs">
            {contextEntries.map(([key, value]) => (
              <Row key={key} icon="KeyRound" label={key} value={String(value)} />
            ))}
          </Stack>
        </Panel>
      </Grid>
    </ScrollArea>
  );
};

const RegistryInventoryWidget = (props: OverviewWidgetProps) => {
  const { input, rendererIds } = props;
  const { workbench } = input;
  const rows = [
    { name: "commands", icon: "Command", values: workbench.commands.listCommands().map((record) => record.command.id) },
    {
      name: "keybindings",
      icon: "Keyboard",
      values: workbench.keybindings.listKeybindings().map((keybinding) => keybinding.commandId),
    },
    { name: "layout", icon: "PanelTop", values: workbench.layout.listWidgets().map((widget) => widget.id) },
    {
      name: "menus",
      icon: "Menu",
      values: workbench.menus.listMenuActions(commandPaletteMenuPath).map((action) => action.commandId),
    },
    {
      name: "notifications",
      icon: "Bell",
      values: workbench.notifications.listNotifications().map((notification) => notification.id),
    },
    { name: "preferences", icon: "SlidersHorizontal", values: [...workbenchPreferenceNames] },
    { name: "resources", icon: "Database", values: workbench.resources.listKinds().map((kind) => kind.kind) },
    { name: "renderers", icon: "Component", values: rendererIds },
    { name: "trees", icon: "ListTree", values: workbench.trees.listTreeViews().map((tree) => tree.id) },
    { name: "lifecycle", icon: "RefreshCw", values: [...workbenchLifecyclePhases] },
  ];

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns="repeat(auto-fit, minmax(16rem, 1fr))" gap="md" w="full" alignItems="start">
        {rows.map((row) => (
          <Panel key={row.name} title={row.name}>
            <Stack gap="xs">
              {row.values.map((value) => (
                <HStack key={value} gap="xs" minW="0">
                  <WorkbenchIcon name={row.icon} size={14} color="fg.muted" />
                  <Code colorPalette="gray" truncate>
                    {value}
                  </Code>
                </HStack>
              ))}
            </Stack>
          </Panel>
        ))}
      </Grid>
    </ScrollArea>
  );
};

const ChecksWidget = (props: WidgetProps) => {
  const { input } = props;

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md" w="full">
        <Panel title="Check summary">
          <Stack gap="2xs">
            <Row
              icon="Keyboard"
              label="Enabled shortcuts"
              value={input.workbench.keybindings.listActiveKeybindings().length}
            />
            <Row icon="Bell" label="Notifications" value={input.workbench.notifications.listNotifications().length} />
          </Stack>
        </Panel>
      </Grid>
    </ScrollArea>
  );
};

const SessionWidget = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="sm" w="full">
      <Panel title="Session A">
        <Stack gap="sm">
          <Row icon="Bot" label="Codex" value="connected" />
        </Stack>
      </Panel>
    </Stack>
  </ScrollArea>
);

const ExtensionReviewWidget = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "lg" }}>
    <Stack gap="md" maxW="2xl">
      <Box>
        <Text textStyle="heading/M/semibold">Extension Lab review</Text>
        <Text color="fg.muted">
          Bridge-backed extension surfaces are rendered through registered workbench renderers.
        </Text>
      </Box>
      <Code>extension-lab.review.panel</Code>
    </Stack>
  </ScrollArea>
);

export const registerConsumerWorkbenchRenderers = (
  ctx: WorkbenchModuleContributionContext,
  ticketResourceIds: Array<string | undefined>,
) => {
  const rendererIds = [
    workbenchWidgetIds.overview,
    workbenchWidgetIds.tickets,
    workbenchWidgetIds.workspace,
    workbenchWidgetIds.settings,
    workbenchWidgetIds.registryInventory,
    workbenchWidgetIds.checks,
    workbenchWidgetIds.session,
    workbenchWidgetIds.extensionReview,
  ];
  const stableTicketIds = ticketResourceIds.filter((id): id is string => Boolean(id));

  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.overview,
    render: (input) => <OverviewWidget input={input} rendererIds={rendererIds} />,
  });
  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.tickets,
    render: (input) => <TicketsWidget key={stableTicketIds.join(",")} input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.workspace,
    render: (input) => <WorkspaceWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.settings,
    render: (input) => <SettingsWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.registryInventory,
    render: (input) => <RegistryInventoryWidget input={input} rendererIds={rendererIds} />,
  });
  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.checks,
    render: (input) => <ChecksWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.session,
    render: () => <SessionWidget />,
  });
  ctx.renderers.registerRenderer({
    id: workbenchWidgetIds.extensionReview,
    render: () => <ExtensionReviewWidget />,
  });
};
