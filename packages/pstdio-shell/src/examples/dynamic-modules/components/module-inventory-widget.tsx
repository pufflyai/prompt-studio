import { Grid, Stack } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ShellWidgetRenderInput } from "../../../core";
import { InventoryRow, Metric, Panel } from "./panel";

export const ModuleInventoryWidget = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const { shell } = input;
  const metrics = [
    { label: "Commands", value: shell.commands.listCommands().length },
    { label: "Widgets", value: shell.layout.listWidgets().length },
    { label: "Resources", value: shell.resources.listKinds().length },
    { label: "Tree views", value: shell.trees.listTreeViews().length },
  ];
  const contributionRows = [
    ...shell.layout.listWidgets().map((widget) => ({
      id: widget.id,
      icon: "PanelTop",
      label: widget.id,
      value: widget.ownerId,
    })),
    ...shell.commands.listCommands().map((command) => ({
      id: command.command.id,
      icon: command.command.icon ?? "Command",
      label: command.command.id,
      value: command.ownerId,
    })),
    ...shell.resources.listKinds().map((kind) => ({
      id: kind.kind,
      icon: kind.icon ?? "Database",
      label: kind.kind,
      value: kind.ownerId,
    })),
    ...shell.trees.listTreeViews().map((tree) => ({
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
      </Stack>
    </ScrollArea>
  );
};
