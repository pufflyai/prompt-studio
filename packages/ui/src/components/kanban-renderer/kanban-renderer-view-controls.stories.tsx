import { Box } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows, type StoryRow } from "./kanban-renderer-story-fixtures";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

const meta: Meta<typeof KanbanRenderer> = {
  title: "Patterns/Kanban Renderer/View Controls",
  component: KanbanRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

interface ViewControlsBoardProps {
  storageKey: string;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
}

const reorder = (rows: StoryRow[], rowId: string, beforeRowId?: string) => {
  const moved = rows.find((row) => row.id === rowId);
  if (!moved) return rows;
  const rest = rows.filter((row) => row.id !== rowId);
  const index = beforeRowId ? rest.findIndex((row) => row.id === beforeRowId) : rest.length;
  return [...rest.slice(0, index), moved, ...rest.slice(index)];
};

const ViewControlsBoard = (props: ViewControlsBoardProps) => {
  const { storageKey, defaultFilter, defaultSorts } = props;
  const [rows, setRows] = useState(initialRows);
  const initialState = {
    settings: { columnGrouping: "status", displayProperties: ["id", "priority", "assignee"] },
    filter: defaultFilter,
    sorts: defaultSorts,
  };
  const reset = useKanbanRendererStore(storageKey, (state) => state.reset, initialState);
  // Reset during the first render, before the renderer picks its first view in an effect.
  useState(reset);

  return (
    <Box p="sm" height="560px">
      <KanbanRenderer<StoryRow>
        rows={rows}
        storageKey={storageKey}
        attributes={attributes}
        defaultSettings={initialState.settings}
        defaultFilter={defaultFilter}
        defaultSorts={defaultSorts}
        onAttributeChange={(rowId, attributeId, value) =>
          setRows((current) =>
            current.map((row) =>
              row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
            ),
          )
        }
        onReorder={(rowId, beforeRowId) => setRows((current) => reorder(current, rowId, beforeRowId))}
        getBoardColumnConfig={() => ({ canDragIn: true, canDragOut: true })}
      />
    </Box>
  );
};

/** Search narrows the cards, marks each match, and counts matches against each column's total. */
export const Search: Story = {
  render: () => <ViewControlsBoard storageKey="storybook-kanban-view-controls-search" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "set up");
    await expect(await canvas.findAllByRole("mark")).not.toHaveLength(0);
    await expect(canvas.queryByText("Write docs")).not.toBeInTheDocument();
  },
};

export const SearchNoMatches: Story = {
  render: () => <ViewControlsBoard storageKey="storybook-kanban-view-controls-no-matches" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "radr");
    await expect(await canvas.findByText("No results for “radr”")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await expect(await canvas.findByText("Write docs")).toBeVisible();
  },
};

/** Rules with conditions, plus an "or" group that reads as one pill. */
export const FilterRules: Story = {
  render: () => (
    <ViewControlsBoard
      storageKey="storybook-kanban-view-controls-rules"
      defaultFilter={{
        conjunction: "and",
        rules: [
          { attributeId: "status", condition: "is-none-of", value: ["done"] },
          {
            conjunction: "or",
            rules: [
              { attributeId: "assignee", condition: "is-any-of", value: ["Alex"] },
              { attributeId: "priority", condition: "is-any-of", value: ["high"] },
            ],
          },
        ],
      }}
    />
  ),
};

/** Cards follow priority inside each column, then the update date; columns keep the status order. */
export const MultiSort: Story = {
  render: () => (
    <ViewControlsBoard
      storageKey="storybook-kanban-view-controls-multi-sort"
      defaultSorts={[
        { attributeId: "priority", direction: "asc" },
        { attributeId: "updated", direction: "desc" },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Sorted by Priority" })).toHaveTextContent("+1");
  },
};

/** Without sorts, dragging a card inside a column keeps the new position. */
export const ManualOrderWithoutSort: Story = {
  render: () => <ViewControlsBoard storageKey="storybook-kanban-view-controls-manual" />,
};
