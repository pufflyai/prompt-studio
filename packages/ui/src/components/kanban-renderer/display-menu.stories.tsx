import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DisplayMenu } from "./display-menu";
import { buildDisplayPropertyOptions, buildGroupingOptions, buildOrderingOptions } from "./kanban-renderer-helpers";
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

const meta: Meta = {
  title: "Patterns/Kanban Renderer/Display Menu",
};

export default meta;

type Story = StoryObj;

const Wrapper = (props: { initialSettings?: KanbanRendererSettings } = {}) => {
  const [settings, setSettings] = useState<KanbanRendererSettings>(
    props.initialSettings ?? DEFAULT_KANBAN_RENDERER_SETTINGS,
  );

  return (
    <Box p="lg">
      <DisplayMenu
        settings={settings}
        groupingOptions={buildGroupingOptions(attributes)}
        orderingOptions={buildOrderingOptions(attributes)}
        displayPropertyOptions={buildDisplayPropertyOptions(attributes)}
        onViewModeChange={(value) => setSettings((current) => ({ ...current, viewMode: value }))}
        onColumnGroupingChange={(value) => setSettings((current) => ({ ...current, columnGrouping: value }))}
        onRowGroupingChange={(value) => setSettings((current) => ({ ...current, rowGrouping: value }))}
        onOrderingAttributeIdChange={(value) =>
          setSettings((current) => ({ ...current, ordering: { ...current.ordering, attributeId: value } }))
        }
        onSortDirectionToggle={() =>
          setSettings((current) => ({
            ...current,
            ordering: {
              ...current.ordering,
              direction: current.ordering.direction === "asc" ? "desc" : "asc",
            },
          }))
        }
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

export const Default: Story = { render: () => <Wrapper /> };

export const AscendingSortMenu: Story = {
  render: () => (
    <Wrapper
      initialSettings={{
        ...DEFAULT_KANBAN_RENDERER_SETTINGS,
        ordering: { attributeId: "updated", direction: "asc" },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Display settings"));
    const displayMenu = within(document.body);
    await expect(displayMenu.getByRole("img", { name: "Ascending order" })).toBeVisible();
    await expect(displayMenu.getByText("Updated").parentElement).not.toHaveTextContent("ASC");
  },
};

export const DescendingSortMenu: Story = {
  render: () => (
    <Wrapper
      initialSettings={{
        ...DEFAULT_KANBAN_RENDERER_SETTINGS,
        ordering: { attributeId: "updated", direction: "desc" },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Display settings"));
    const displayMenu = within(document.body);
    await expect(displayMenu.getByRole("img", { name: "Descending order" })).toBeVisible();
    await expect(displayMenu.getByText("Updated").parentElement).not.toHaveTextContent("DESC");
  },
};

export const ToggleViewMode: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Display settings"));
    await userEvent.click(within(document.body).getByRole("button", { name: "List" }));
    await expect(canvas.getByTestId("view-mode-value")).toHaveTextContent("list");
  },
};
