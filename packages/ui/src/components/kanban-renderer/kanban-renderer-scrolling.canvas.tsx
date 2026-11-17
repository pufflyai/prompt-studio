import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: CanvasMeta = {
  title: "Design system/Patterns/Kanban renderer/Column scrolling",
};
export default meta;
const items = Array.from({ length: 60 }, (_, index) => ({
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
      <HStack>
        <Button size="sm" onClick={() => setVisibleCount(1)}>
          Keep one card
        </Button>
        <Button size="sm" onClick={() => setVisibleCount(40)}>
          Show 40 cards
        </Button>
        <Button size="sm" onClick={() => setVisibleCount(60)}>
          Show 60 cards
        </Button>
      </HStack>
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
export const FittingCards: CanvasFrame = {
  id: "patterns-kanban-renderer-column-scrolling--fitting-cards",
  render: () => <ColumnExample count={5} />,
};
export const OverflowingCards: CanvasFrame = {
  id: "patterns-kanban-renderer-column-scrolling--overflowing-cards",
  render: () => <ColumnExample count={60} />,
};
export const GroupedCards: CanvasFrame = {
  id: "patterns-kanban-renderer-column-scrolling--grouped-cards",
  render: () => <ColumnExample count={60} grouped />,
};
