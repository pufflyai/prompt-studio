import { Badge, Box, Button, Code, Grid, HStack, Kbd, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ShellModuleContributionContext } from "../../../core";
import { ShellIcon, type ShellWidgetRenderInput } from "../../../react";
import {
  commandPaletteMenuPath,
  resourceContextMenuPath,
  shellExampleTickets,
  shellLifecyclePhases,
  shellPreferenceNames,
  shellWidgetIds,
} from "../mock-data/data";
import { Metric, Panel, Row } from "./panel";

interface WidgetProps {
  input: ShellWidgetRenderInput;
}

interface OverviewWidgetProps extends WidgetProps {
  rendererIds: string[];
}

const openCommand = (input: ShellWidgetRenderInput, commandId: string, args?: unknown) => {
  void input.shell.commands.executeCommand(commandId, args).then(input.refresh);
};

const OverviewWidget = (props: OverviewWidgetProps) => {
  const { input, rendererIds } = props;
  const { shell } = input;
  const menuActionCount =
    shell.menus.listMenuActions(commandPaletteMenuPath).length +
    shell.menus.listMenuActions(resourceContextMenuPath).length;
  const metrics = [
    { label: "Commands", value: shell.commands.listCommands().length },
    { label: "Menu actions", value: menuActionCount },
    { label: "Resource kinds", value: shell.resources.listKinds().length },
    { label: "Tree views", value: shell.trees.listTreeViews().length },
    { label: "React renderers", value: rendererIds.length },
    { label: "Notifications", value: shell.notifications.listNotifications().length },
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
                <ShellIcon name="Play" />
                Run
              </Button>
            }
          >
            <Stack gap="2xs">
              {shell.commands.listCommands().map((record) => (
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
              <Row icon="Bell" label="Notifications" value={shell.notifications.listNotifications().length} />
              <Row
                icon="Keyboard"
                label="Active keybindings"
                value={shell.keybindings.listActiveKeybindings().length}
              />
              <Row icon="PanelTop" label="Lifecycle hooks" value={shellLifecyclePhases.join(", ")} />
              {shell.resources.listKinds().map((kind) => (
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
              {shellExampleTickets
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
                        void input.shell.resources.openResource(ticket.resource).then(input.refresh);
                      }}
                    >
                      <ShellIcon name="ExternalLink" />
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
  const activeKeybindings = input.shell.keybindings.listActiveKeybindings();

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md" w="full">
        <Panel title="Workspace resources">
          <Stack gap="2xs">
            {input.shell.resources.listKinds().map((kind) => (
              <Row key={kind.kind} icon={kind.icon} label={kind.kind} value={kind.label} />
            ))}
          </Stack>
        </Panel>
        <Panel title="Active keybindings">
          <Stack gap="xs">
            {activeKeybindings.map((keybinding) => {
              const command = input.shell.commands.getCommand(keybinding.commandId)?.command;
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
  const contextEntries = Object.entries(input.shell.context.snapshot());

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md" w="full">
        <Panel title="Preferences">
          <Stack gap="2xs">
            {shellPreferenceNames.map((name) => (
              <Row
                key={name}
                icon="SlidersHorizontal"
                label={name}
                value={String(input.shell.preferences.getValue(name))}
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
  const { shell } = input;
  const rows = [
    { name: "commands", icon: "Command", values: shell.commands.listCommands().map((record) => record.command.id) },
    {
      name: "keybindings",
      icon: "Keyboard",
      values: shell.keybindings.listKeybindings().map((keybinding) => keybinding.commandId),
    },
    { name: "layout", icon: "PanelTop", values: shell.layout.listWidgets().map((widget) => widget.id) },
    {
      name: "menus",
      icon: "Menu",
      values: shell.menus.listMenuActions(commandPaletteMenuPath).map((action) => action.commandId),
    },
    {
      name: "notifications",
      icon: "Bell",
      values: shell.notifications.listNotifications().map((notification) => notification.id),
    },
    { name: "preferences", icon: "SlidersHorizontal", values: [...shellPreferenceNames] },
    { name: "resources", icon: "Database", values: shell.resources.listKinds().map((kind) => kind.kind) },
    { name: "renderers", icon: "Component", values: rendererIds },
    { name: "trees", icon: "ListTree", values: shell.trees.listTreeViews().map((tree) => tree.id) },
    { name: "lifecycle", icon: "RefreshCw", values: [...shellLifecyclePhases] },
  ];

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns="repeat(auto-fit, minmax(16rem, 1fr))" gap="md" w="full" alignItems="start">
        {rows.map((row) => (
          <Panel key={row.name} title={row.name}>
            <Stack gap="xs">
              {row.values.map((value) => (
                <HStack key={value} gap="xs" minW="0">
                  <ShellIcon name={row.icon} size={14} color="fg.muted" />
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
              value={input.shell.keybindings.listActiveKeybindings().length}
            />
            <Row icon="Bell" label="Notifications" value={input.shell.notifications.listNotifications().length} />
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
        <Text color="fg.muted">Bridge-backed extension surfaces are rendered through registered shell renderers.</Text>
      </Box>
      <Code>extension-lab.review.panel</Code>
    </Stack>
  </ScrollArea>
);

export const registerConsumerShellRenderers = (
  ctx: ShellModuleContributionContext,
  ticketResourceIds: Array<string | undefined>,
) => {
  const rendererIds = [
    shellWidgetIds.overview,
    shellWidgetIds.tickets,
    shellWidgetIds.workspace,
    shellWidgetIds.settings,
    shellWidgetIds.registryInventory,
    shellWidgetIds.checks,
    shellWidgetIds.session,
    shellWidgetIds.extensionReview,
  ];
  const stableTicketIds = ticketResourceIds.filter((id): id is string => Boolean(id));

  ctx.renderers.registerRenderer({
    id: shellWidgetIds.overview,
    render: (input) => <OverviewWidget input={input} rendererIds={rendererIds} />,
  });
  ctx.renderers.registerRenderer({
    id: shellWidgetIds.tickets,
    render: (input) => <TicketsWidget key={stableTicketIds.join(",")} input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: shellWidgetIds.workspace,
    render: (input) => <WorkspaceWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: shellWidgetIds.settings,
    render: (input) => <SettingsWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: shellWidgetIds.registryInventory,
    render: (input) => <RegistryInventoryWidget input={input} rendererIds={rendererIds} />,
  });
  ctx.renderers.registerRenderer({
    id: shellWidgetIds.checks,
    render: (input) => <ChecksWidget input={input} />,
  });
  ctx.renderers.registerRenderer({
    id: shellWidgetIds.session,
    render: () => <SessionWidget />,
  });
  ctx.renderers.registerRenderer({
    id: shellWidgetIds.extensionReview,
    render: () => <ExtensionReviewWidget />,
  });
};
