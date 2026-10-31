import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { KanbanRenderer } from "./kanban-renderer";
import { attributes, initialRows } from "./kanban-renderer-story-fixtures";
import type { ViewMode } from "./types";
import { useKanbanRendererStore } from "./use-kanban-renderer-store";

const meta: CanvasMeta = { title: "Patterns/Kanban Renderer/Filtered Groups", fullscreen: true };
export default meta;
type Story = CanvasFrame;
const FilteredGroups = (props: { mode: ViewMode; empty?: boolean; grouped?: boolean }) => {
  const key = `preview-empty-filter-groups-${props.mode}-${props.empty ?? false}-${props.grouped ?? true}`;
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
  id: "patterns-kanban-renderer-filtered-groups--board",
  render: () => <FilteredGroups mode="board" />,
};
export const List: Story = {
  id: "patterns-kanban-renderer-filtered-groups--list",
  render: () => <FilteredGroups mode="list" />,
};
export const Ungrouped: Story = {
  id: "patterns-kanban-renderer-filtered-groups--ungrouped",
  render: () => <FilteredGroups mode="list" grouped={false} />,
};
export const EmptyCollection: Story = {
  id: "patterns-kanban-renderer-filtered-groups--empty-collection",
  render: () => <FilteredGroups mode="list" empty grouped={false} />,
};
