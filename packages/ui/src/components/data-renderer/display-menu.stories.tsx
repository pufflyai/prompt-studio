import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DisplayMenu } from "./display-menu";
import {
  type DataRendererSettings,
  DEFAULT_DATA_RENDERER_SETTINGS,
  DEFAULT_DISPLAY_PROPERTY_OPTIONS,
  DEFAULT_GROUPING_OPTIONS,
  DEFAULT_ORDERING_OPTIONS,
} from "./types";

const meta: Meta = {
  title: "Tickets/DisplayMenu",
};

export default meta;

type Story = StoryObj;

const Wrapper = () => {
  const [settings, setSettings] = useState<DataRendererSettings>(DEFAULT_DATA_RENDERER_SETTINGS);

  return (
    <Box p="lg">
      <DisplayMenu
        settings={settings}
        groupingOptions={DEFAULT_GROUPING_OPTIONS}
        orderingOptions={DEFAULT_ORDERING_OPTIONS}
        displayPropertyOptions={DEFAULT_DISPLAY_PROPERTY_OPTIONS}
        onViewModeChange={(value) => setSettings((current) => ({ ...current, viewMode: value }))}
        onColumnGroupingChange={(value) => setSettings((current) => ({ ...current, columnGrouping: value }))}
        onRowGroupingChange={(value) => setSettings((current) => ({ ...current, rowGrouping: value }))}
        onOrderingFieldChange={(value) =>
          setSettings((current) => ({
            ...current,
            ordering: { ...current.ordering, field: value },
          }))
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

export const Default: Story = {
  render: () => <Wrapper />,
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

export const SelectDisplayOptions: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Display settings"));
    await userEvent.click(within(document.body).getAllByRole("button", { name: "Status" })[1]!);
    await expect(canvas.getByTestId("display-properties-value")).toHaveTextContent("status");

    await userEvent.click(within(document.body).getAllByRole("button", { name: "Status" })[0]!);
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Assignee" }));
    await expect(canvas.getByTestId("column-grouping-value")).toHaveTextContent("assignee");
  },
};
