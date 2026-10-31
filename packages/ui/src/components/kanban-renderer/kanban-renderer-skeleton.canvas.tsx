import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { KanbanRendererSkeleton } from "./kanban-renderer-skeleton";

const meta: CanvasMeta<typeof KanbanRendererSkeleton> = {
  title: "Patterns/Kanban Renderer/Loading",
  component: KanbanRendererSkeleton,
  fullscreen: true,
  args: { viewMode: "board" },
  decorators: [
    (Story) => (
      <Box height="100vh">
        <Story />
      </Box>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof KanbanRendererSkeleton>;
export const Board: Story = {
  id: "patterns-kanban-renderer-loading--board",
};
export const List: Story = {
  id: "patterns-kanban-renderer-loading--list",
  args: { viewMode: "list" },
};
