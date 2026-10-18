import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, within } from "storybook/test";
import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: Meta = { title: "Patterns/Kanban Renderer/Large Board", tags: ["!manifest"] };
export default meta;

const items = Array.from({ length: 1_000 }, (_, index) => ({
  id: `row-${index}`,
  cardProps: { title: `Ticket ${index + 1}. ${"A task with variable height. ".repeat(index % 4)}` },
  contextMenuActions: [{ key: "open", label: "Open ticket", onClick: () => undefined }],
}));
const column: KanbanRendererBoardColumn = {
  id: "todo",
  label: "Todo",
  items,
  actions: [],
  canDragIn: true,
  canDragOut: true,
  canCreate: false,
};

export const VariableHeightCards: StoryObj = {
  render: () => (
    <Box height="600px">
      <KanbanRendererBoard columns={[column]} />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByTestId("renderer-card").length).toBeLessThan(30);
    const first = canvas.getByRole("button", { name: "Ticket 1." });
    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    const last = await canvas.findByRole("button", { name: items[999].cardProps.title.trim() });
    await expect(last).toHaveFocus();
    await expect(canvas.getAllByTestId("renderer-card").length).toBeLessThan(30);
    fireEvent.keyDown(last, { key: "Home" });
    await expect(await canvas.findByRole("button", { name: "Ticket 1." })).toHaveFocus();
  },
};

export const GroupedCards: StoryObj = {
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
