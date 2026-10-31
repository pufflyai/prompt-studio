import { Box, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { DisplayMenu } from "./display-menu";
import { buildDisplayPropertyOptions, buildGroupingOptions } from "./kanban-renderer-helpers";
import type { AttributeDescriptor, KanbanRendererSettings } from "./types";
import { DEFAULT_KANBAN_RENDERER_SETTINGS } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: { kind: "enum", options: [{ value: "todo", label: "Todo" }] },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
];
const meta: CanvasMeta = {
  title: "Patterns/Kanban Renderer/Display Menu",
};
export default meta;
type Story = CanvasFrame;
const Wrapper = (props: { initialSettings?: KanbanRendererSettings } = {}) => {
  const [settings, setSettings] = useState<KanbanRendererSettings>(
    props.initialSettings ?? DEFAULT_KANBAN_RENDERER_SETTINGS,
  );
  return (
    <Box p="lg">
      <DisplayMenu
        settings={settings}
        groupingOptions={buildGroupingOptions(attributes)}
        displayPropertyOptions={buildDisplayPropertyOptions(attributes)}
        onViewModeChange={(value) => setSettings((current) => ({ ...current, viewMode: value }))}
        onColumnGroupingChange={(value) => setSettings((current) => ({ ...current, columnGrouping: value }))}
        onRowGroupingChange={(value) => setSettings((current) => ({ ...current, rowGrouping: value }))}
        onDisplayPropertyToggle={(value) =>
          setSettings((current) => ({
            ...current,
            displayProperties: current.displayProperties.includes(value)
              ? current.displayProperties.filter((entry) => entry !== value)
              : [...current.displayProperties, value],
          }))
        }
      />
      <Text mt="sm" data-testid="view-mode-value">
        {settings.viewMode}
      </Text>
      <Text mt="sm" data-testid="column-grouping-value">
        {settings.columnGrouping}
      </Text>
      <Text mt="sm" data-testid="display-properties-value">
        {settings.displayProperties.join(",")}
      </Text>
    </Box>
  );
};
export const Default: Story = {
  id: "patterns-kanban-renderer-display-menu--default",
  render: () => <Wrapper />,
};
export const ToggleViewMode: Story = {
  id: "patterns-kanban-renderer-display-menu--toggle-view-mode",
  render: () => <Wrapper />,
};
