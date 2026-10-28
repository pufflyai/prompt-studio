import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows } from "./kanban-renderer-story-fixtures";
import type { ViewMode } from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

const meta: Meta = { title: "Patterns/Kanban Renderer/Filtered Groups", parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj;

const FilteredGroups = (props: { mode: ViewMode; empty?: boolean; grouped?: boolean }) => {
  const key = `storybook-empty-filter-groups-${props.mode}-${props.empty ?? false}-${props.grouped ?? true}`;
  const initial = {
    settings: {
      viewMode: props.mode,
      columnGrouping: props.grouped === false ? "none" : "status",
      rowGrouping: props.grouped === false ? "none" : "assignee",
      displayProperties: [],
    },
    filter: {
      conjunction: "and" as const,
      rules: [{ attributeId: "title", condition: "contains" as const, value: "no matching title" }],
    },
  };
  const reset = useKanbanRendererStore(key, (state) => state.reset, initial);
  useState(reset);
  return (
    <Box height={props.mode === "list" && props.grouped !== false ? "20rem" : "32rem"}>
      <KanbanRenderer
        rows={props.empty ? [] : initialRows}
        attributes={attributes}
        storageKey={key}
        defaultSettings={initial.settings}
        defaultFilter={initial.filter}
        emptyTitle="No tickets yet"
      />
    </Box>
  );
};

export const Board: Story = {
  render: () => <FilteredGroups mode="board" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Todo", { exact: true })).toBeVisible();
    expect(canvas.queryByText("Nothing matches this view", { exact: true })).toBeNull();
    await expect(canvas.getAllByText("Alex", { exact: true })[0]).toBeVisible();
    await expect(canvas.getByText("In progress", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    const body = within(canvasElement.ownerDocument.body);
    const picker = within(await body.findByTestId("filter-menu"));
    await waitFor(() => expect(picker.getByRole("textbox", { name: "Filter properties" })).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByTestId("filter-menu")).toBeNull());
    await userEvent.click(canvas.getByRole("button", { name: "Remove Title filter" }));
    await expect(await canvas.findByText(initialRows[0]!.title, { exact: true })).toBeVisible();
  },
};
export const List: Story = {
  render: () => <FilteredGroups mode="list" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Todo", { exact: true })).toBeVisible();
    expect(canvas.queryByText("Nothing matches this view", { exact: true })).toBeNull();
    await expect(canvas.getAllByText("Alex", { exact: true })[0]).toBeVisible();
    const viewport = canvas.getByLabelText("Collection list");
    viewport.scrollTop = viewport.scrollHeight;
    const lastGroup = canvas.getAllByRole("option").at(-1)!;
    await waitFor(() => {
      const groupBounds = lastGroup.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      expect(viewport.scrollTop).toBeGreaterThan(0);
      expect(groupBounds.top).toBeGreaterThanOrEqual(viewportBounds.top);
      expect(groupBounds.bottom).toBeLessThanOrEqual(viewportBounds.bottom);
    });
  },
};

export const Ungrouped: Story = {
  render: () => <FilteredGroups mode="list" grouped={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Nothing matches this view", { exact: true })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Edit filter", exact: true }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByTestId("filter-menu")).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByTestId("filter-menu")).toBeNull());
    await userEvent.click(canvas.getByRole("button", { name: "Remove Title filter" }));
    await expect(await canvas.findByText(initialRows[0]!.title, { exact: true })).toBeVisible();
  },
};

export const EmptyCollection: Story = {
  render: () => <FilteredGroups mode="list" empty grouped={false} />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText("No tickets yet", { exact: true })).toBeVisible();
  },
};
