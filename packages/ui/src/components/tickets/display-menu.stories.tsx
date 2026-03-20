import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { DisplayMenu } from "./display-menu";
import {
  DEFAULT_DISPLAY_PROPERTY_OPTIONS,
  DEFAULT_GROUPING_OPTIONS,
  DEFAULT_ORDERING_OPTIONS,
  DEFAULT_WORKSPACE_SETTINGS,
  type WorkspaceSettings,
} from "./types";

const meta: Meta = {
  title: "Tickets/DisplayMenu",
};

export default meta;

type Story = StoryObj;

const Wrapper = () => {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);

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
    await userEvent.click(within(document.body).getByText("List"));
    await expect(canvas.getByTestId("view-mode-value")).toHaveTextContent("list");
  },
};
