import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: Meta = { title: "Patterns/Kanban Renderer/Card Stability", tags: ["!manifest"] };
export default meta;

const cardContent = fn(() => ({ title: "Review ticket filters" }));
const cardActions = fn(() => [{ key: "open", label: "Open ticket", onClick: () => undefined }]);
const column: KanbanRendererBoardColumn = {
  id: "backlog",
  label: "Backlog",
  actions: [],
  canDragIn: true,
  canDragOut: true,
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

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export const DragRetainsCardContent: StoryObj = {
  render: () => (
    <Box height="lg">
      <KanbanRendererBoard columns={[column]} />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByTestId("renderer-card");
    const target = canvas.getByTestId("board-column-backlog");
    await nextPaint();
    cardContent.mockClear();
    cardActions.mockClear();
    const dataTransfer = new DataTransfer();
    const bounds = card.getBoundingClientRect();
    const event = (type: string) =>
      new DragEvent(type, {
        dataTransfer,
        bubbles: true,
        cancelable: true,
        clientX: bounds.x + bounds.width / 2,
        clientY: bounds.y + bounds.height / 2,
      });
    card.dispatchEvent(event("dragstart"));
    target.dispatchEvent(event("dragover"));
    await nextPaint();
    card.dispatchEvent(event("dragend"));
    await nextPaint();
    // Drag feedback must not rebuild an unchanged extension card or its menu.
    await expect(cardContent).not.toHaveBeenCalled();
    await expect(cardActions).not.toHaveBeenCalled();
    await expect(canvas.getByText("Review ticket filters")).toBeVisible();
  },
};
