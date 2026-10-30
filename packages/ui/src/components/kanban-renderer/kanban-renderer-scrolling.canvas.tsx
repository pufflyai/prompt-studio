import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: CanvasMeta = {
  title: "Patterns/Kanban Renderer/Column Scrolling",
  tags: ["!manifest", "ticket-column-scrollbar"],
};
export default meta;
const items = Array.from({ length: 40 }, (_, index) => ({
  id: `ticket-${index}`,
  cardProps: { title: `Ticket ${index + 1}. ${"A task with a longer title. ".repeat(index % 3)}` },
}));
const column: KanbanRendererBoardColumn = {
  id: "todo",
  label: "Todo",
  items,
  actions: [],
  canCreate: false,
};
const ColumnExample = (props: { count: number; grouped?: boolean }) => {
  const { count, grouped } = props;
  const [visibleCount, setVisibleCount] = useState(count);
  const visibleItems = items.slice(0, visibleCount);
  return (
    <Stack alignItems="start">
      <Button size="sm" onClick={() => setVisibleCount(1)}>
        Keep one card
      </Button>
      <Box data-testid="board-frame" height="lg" width="sm">
        <KanbanRendererBoard
          columns={[
            {
              ...column,
              items: visibleItems,
              groups: grouped ? [{ key: "priority", label: "High priority", items: visibleItems }] : undefined,
            },
          ]}
        />
      </Box>
    </Stack>
  );
};
export const FittingCards: CanvasVariant = {
  id: "patterns-kanban-renderer-column-scrolling--fitting-cards",
  render: () => <ColumnExample count={5} />,
};
export const OverflowingCards: CanvasVariant = {
  id: "patterns-kanban-renderer-column-scrolling--overflowing-cards",
  render: () => <ColumnExample count={40} />,
};
export const GroupedCards: CanvasVariant = {
  id: "patterns-kanban-renderer-column-scrolling--grouped-cards",
  render: () => <ColumnExample count={40} grouped />,
};
