import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { KanbanRenderer } from "./kanban-renderer";
import type { AttributeDescriptor, KanbanRendererRow } from "./types";

const meta: Meta = {
  title: "Patterns/Kanban Renderer/Dragging",
  tags: ["!manifest"],
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    groupable: true,
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo" },
        { value: "done", label: "Done" },
      ],
    },
  },
  {
    id: "team",
    label: "Team",
    groupable: true,
    type: {
      kind: "enum",
      options: [
        { value: "design", label: "Design" },
        { value: "product", label: "Product" },
      ],
    },
  },
];

const initialRows: KanbanRendererRow[] = [
  { id: "unknown", title: "Recover an unknown status", attributes: { status: "removed", team: "design" } },
  { id: "missing", title: "Assign a missing status", attributes: { status: null, team: "design" } },
  { id: "done", title: "Move a completed card", attributes: { status: "done", team: "product" } },
];

const DraggingBoard = (props: { grouped?: boolean; ungrouped?: boolean }) => {
  const { grouped = false, ungrouped = false } = props;
  const [rows, setRows] = useState(initialRows);
  return (
    <Box p="sm" height="560px">
      <KanbanRenderer
        rows={rows}
        attributes={attributes}
        storageKey={`storybook-kanban-dragging-${grouped}-${ungrouped}`}
        hideToolbar
        defaultSettings={{
          viewMode: "board",
          columnGrouping: ungrouped ? "none" : "status",
          rowGrouping: grouped ? "team" : "none",
          displayProperties: [],
        }}
        onMove={({ rowId, attributes: changes }) =>
          setRows((current) =>
            current.map((row) => (row.id === rowId ? { ...row, attributes: { ...row.attributes, ...changes } } : row)),
          )
        }
      />
    </Box>
  );
};

const dropCard = async (canvasElement: HTMLElement, title: string, target: HTMLElement) => {
  const card = within(canvasElement).getByText(title).closest<HTMLElement>('[data-testid="renderer-card"]')!;
  await expect(card).toHaveAttribute("draggable", "true");
  await userEvent.hover(card);
  const dataTransfer = new DataTransfer();
  card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
  target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
  target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  card.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
};

export const MissingAndUnknownStatus: Story = {
  render: () => <DraggingBoard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const todo = canvas.getByTestId("board-column-todo");
    const done = canvas.getByTestId("board-column-done");
    await dropCard(canvasElement, "Recover an unknown status", todo);
    await expect(await within(todo).findByText("Recover an unknown status")).toBeVisible();
    await dropCard(canvasElement, "Assign a missing status", done);
    await expect(await within(done).findByText("Assign a missing status")).toBeVisible();
    const beforeCard = within(todo).getByRole("button", { name: "Recover an unknown status" });
    await dropCard(canvasElement, "Move a completed card", beforeCard);
    await expect(await within(todo).findByText("Move a completed card")).toBeVisible();
  },
};

export const GroupedRows: Story = {
  render: () => <DraggingBoard grouped />,
  play: async ({ canvasElement }) => {
    const done = within(canvasElement).getByTestId("board-column-done");
    await dropCard(canvasElement, "Recover an unknown status", within(done).getByRole("button", { name: /Product/ }));
    await expect(await within(done).findByText("Recover an unknown status")).toBeVisible();
    const entry = within(done).getByText("Recover an unknown status").closest("[data-group-key]");
    await expect(entry).toHaveAttribute("data-group-key", "product");
  },
};

export const UngroupedBoard: Story = {
  render: () => <DraggingBoard ungrouped />,
  play: async ({ canvasElement }) => {
    const column = within(canvasElement).getByTestId("board-column-all");
    await dropCard(canvasElement, "Recover an unknown status", column);
    await expect(await within(column).findByText("Recover an unknown status")).toBeVisible();
  },
};
