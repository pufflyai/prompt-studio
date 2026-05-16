import { Badge, Button, Code, Grid, HStack, Kbd, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "../../../core";
import { WorkbenchIcon } from "../../../react";
import { useWorkbenchStore } from "../../../react/shared/use-workbench-store";
import { InventoryRow, Metric, Panel } from "./panel";

export const ModuleInventoryWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const { workbench } = input;
  const activeTheme = useWorkbenchStore(workbench.theme.store, (state) => state.theme);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.resources.store, (state) => state.kinds);
  useWorkbenchStore(workbench.theme.store, (state) => state.themes);
  useWorkbenchStore(workbench.trees.store, (state) => state.views);

  const commands = workbench.commands.listCommands();
  const keybindings = workbench.keybindings.listKeybindings();
  const themes = workbench.theme.listThemes();

  const metrics = [
    { label: "Commands", value: commands.length },
    { label: "Shortcuts", value: keybindings.length },
    { label: "Themes", value: themes.length },
    { label: "Widgets", value: workbench.layout.listWidgets().length },
    { label: "Resources", value: workbench.resources.listKinds().length },
    { label: "Tree views", value: workbench.trees.listTreeViews().length },
  ];
  const contributionRows = [
    ...workbench.layout.listWidgets().map((widget) => ({
      id: widget.id,
      icon: "PanelTop",
      label: widget.id,
      value: widget.ownerId,
    })),
    ...commands.map((command) => ({
      id: command.command.id,
      icon: command.command.icon ?? "Command",
      label: command.command.id,
      value: command.ownerId,
    })),
    ...workbench.resources.listKinds().map((kind) => ({
      id: kind.kind,
      icon: kind.icon ?? "Database",
      label: kind.kind,
      value: kind.ownerId,
    })),
    ...workbench.trees.listTreeViews().map((tree) => ({
      id: tree.id,
      icon: tree.icon ?? "ListTree",
      label: tree.id,
      value: tree.ownerId,
    })),
  ];

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="md" w="full">
        <Grid templateColumns="repeat(auto-fit, minmax(8rem, 1fr))" gap="sm">
          {metrics.map((metric) => (
            <Metric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </Grid>
        <Panel title="Registered contributions">
          <Grid templateColumns={{ base: "1fr", xl: "repeat(2, minmax(0, 1fr))" }} gapX="lg" gapY="2xs">
            {contributionRows.map((row) => (
              <InventoryRow key={`${row.value}:${row.id}`} icon={row.icon} label={row.label} value={row.value} />
            ))}
          </Grid>
        </Panel>
        <Grid templateColumns={{ base: "1fr", xl: "minmax(0, 1fr) minmax(0, 1fr)" }} gap="md">
          <Panel title="Available themes">
            <Stack gap="2xs">
              {themes.map((theme) => {
                const active = theme.id === activeTheme.id;
                return (
                  <HStack key={theme.id} data-theme-id={theme.id} gap="xs" minW="0">
                    <WorkbenchIcon name="Palette" size={14} color="fg.muted" />
                    <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
                      {theme.id}
                    </Text>
                    {active ? <Badge colorPalette="green">active</Badge> : null}
                    <Button size="xs" variant="subtle" onClick={() => workbench.theme.setTheme(theme.id)}>
                      Use
                    </Button>
                  </HStack>
                );
              })}
            </Stack>
          </Panel>
          <Panel title="Shortcuts">
            <Stack gap="2xs">
              {keybindings.map((keybinding) => {
                const command = workbench.commands.getCommand(keybinding.commandId)?.command;
                return (
                  <HStack
                    key={`${keybinding.commandId}:${keybinding.keybinding}`}
                    data-keybinding-command-id={keybinding.commandId}
                    data-keybinding-when={keybinding.when ?? ""}
                    gap="xs"
                    minW="0"
                  >
                    <WorkbenchIcon name="Keyboard" size={14} color="fg.muted" />
                    <Text textStyle="paragraph/S/regular" color="fg" flex="1" minW="0" truncate>
                      {command?.label ?? keybinding.commandId}
                    </Text>
                    <Kbd>{keybinding.keybinding}</Kbd>
                    <Code colorPalette="blue" truncate>
                      {keybinding.when ?? "always"}
                    </Code>
                    <Code colorPalette="gray" truncate>
                      {keybinding.ownerId ?? "workbench"}
                    </Code>
                  </HStack>
                );
              })}
            </Stack>
          </Panel>
        </Grid>
      </Stack>
    </ScrollArea>
  );
};
