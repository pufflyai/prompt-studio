import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: CanvasMeta = { title: "Patterns/Kanban Renderer/Large Board", tags: ["!manifest"] };
export default meta;
const items = Array.from({ length: 1000 }, (_, index) => ({
  id: `row-${index}`,
  cardProps: { title: `Ticket ${index + 1}. ${"A task with variable height. ".repeat(index % 4)}` },
  contextMenuActions: [{ key: "open", label: "Open ticket", onClick: () => undefined }],
}));
const column: KanbanRendererBoardColumn = {
  id: "todo",
  label: "Todo",
  items,
  actions: [],
  canCreate: false,
};
export const VariableHeightCards: CanvasVariant = {
  id: "patterns-kanban-renderer-large-board--variable-height-cards",
  render: () => (
    <Box height="600px">
      <KanbanRendererBoard columns={[column]} />
    </Box>
  ),
};
export const GroupedCards: CanvasVariant = {
  id: "patterns-kanban-renderer-large-board--grouped-cards",
  render: () => (
    <Box height="600px">
      <KanbanRendererBoard
        columns={[
          {
            ...column,
            groups: [
              { key: "row-0", label: "High", items: items.slice(0, 500) },
              { key: "medium", label: "Medium", items: items.slice(0, 25).concat(items.slice(500)) },
            ],
          },
        ]}
      />
    </Box>
  ),
};
