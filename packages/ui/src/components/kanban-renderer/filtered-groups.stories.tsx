import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows } from "./kanban-renderer-story-fixtures";
import type { ViewMode } from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

const meta: Meta = { title: "Patterns/Kanban Renderer/Filtered Groups", parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj;

const FilteredGroups = (props: { mode: ViewMode }) => {
  const key = `storybook-empty-filter-groups-${props.mode}`;
  const initial = {
    settings: { viewMode: props.mode, columnGrouping: "status", rowGrouping: "assignee", displayProperties: [] },
    filter: {
      conjunction: "and" as const,
      rules: [{ attributeId: "title", condition: "contains" as const, value: "no matching title" }],
    },
  };
  const reset = useKanbanRendererStore(key, (state) => state.reset, initial);
  useState(reset);
  return (
    <Box height="32rem">
      <KanbanRenderer
        rows={initialRows}
        attributes={attributes}
        storageKey={key}
        defaultSettings={initial.settings}
        defaultFilter={initial.filter}
      />
    </Box>
  );
};

export const Board: Story = {
  render: () => <FilteredGroups mode="board" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Todo", { exact: true })).toBeVisible();
    await expect(canvas.getAllByText("Alex", { exact: true })[0]).toBeVisible();
    await expect(canvas.getByText("In progress", { exact: true })).toBeVisible();
  },
};
export const List: Story = {
  render: () => <FilteredGroups mode="list" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Todo", { exact: true })).toBeVisible();
    await expect(canvas.getAllByText("Alex", { exact: true })[0]).toBeVisible();
  },
};
