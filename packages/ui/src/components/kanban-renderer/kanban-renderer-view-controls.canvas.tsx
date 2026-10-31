import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows, type StoryRow } from "./kanban-renderer-story-fixtures";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

const meta: CanvasMeta<typeof KanbanRenderer> = {
  title: "Patterns/Kanban Renderer/View Controls",
  component: KanbanRenderer,
  fullscreen: true,
};
export default meta;
type Story = CanvasFrame;
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
      />
    </Box>
  );
};
/** Search narrows the cards, marks each match, and counts matches against each column's total. */
export const Search: Story = {
  id: "patterns-kanban-renderer-view-controls--search",
  render: () => <ViewControlsBoard storageKey="preview-kanban-view-controls-search" />,
};
export const SearchNoMatches: Story = {
  id: "patterns-kanban-renderer-view-controls--search-no-matches",
  render: () => <ViewControlsBoard storageKey="preview-kanban-view-controls-no-matches" />,
};
/** Rules with conditions, plus an "or" group that reads as one pill. */
export const FilterRules: Story = {
  id: "patterns-kanban-renderer-view-controls--filter-rules",
  render: () => (
    <ViewControlsBoard
      storageKey="preview-kanban-view-controls-rules"
      defaultFilter={{
        conjunction: "and",
        rules: [{ attributeId: "status", condition: "is-none-of", value: ["done"] }],
        groups: [
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
  id: "patterns-kanban-renderer-view-controls--multi-sort",
  render: () => (
    <ViewControlsBoard
      storageKey="preview-kanban-view-controls-multi-sort"
      defaultSorts={[
        { attributeId: "priority", direction: "asc" },
        { attributeId: "updated", direction: "desc" },
      ]}
    />
  ),
};
/** Without sorts, dragging a card inside a column keeps the new position. */
export const ManualOrderWithoutSort: Story = {
  id: "patterns-kanban-renderer-view-controls--manual-order-without-sort",
  render: () => <ViewControlsBoard storageKey="preview-kanban-view-controls-manual" />,
};
