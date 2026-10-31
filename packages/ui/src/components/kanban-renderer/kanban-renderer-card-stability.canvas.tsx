import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: CanvasMeta = { title: "Patterns/Kanban Renderer/Card Stability" };
export default meta;
const cardContent = () => ({ title: "Review ticket filters" });
const cardActions = () => [{ key: "open", label: "Open ticket", onClick: () => undefined }];
const column: KanbanRendererBoardColumn = {
  id: "backlog",
  label: "Backlog",
  actions: [],
  canCreate: false,
  items: [
    {
      id: "task",
      get cardProps() {
        return cardContent();
      },
      get contextMenuActions() {
        return cardActions();
      },
    },
  ],
};
export const DragRetainsCardContent: CanvasFrame = {
  id: "patterns-kanban-renderer-card-stability--drag-retains-card-content",
  render: () => (
    <Box height="lg">
      <KanbanRendererBoard columns={[column]} />
    </Box>
  ),
};
