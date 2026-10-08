import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Archive, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { expect, fireEvent, fn, userEvent, waitFor, within } from "storybook/test";

import { KanbanRendererBoard, type KanbanRendererBoardColumn } from "./kanban-renderer-board";

const meta: Meta = {
  title: "Patterns/Kanban Renderer/Board",
};

export default meta;

type Story = StoryObj;

const runAttempt = fn();

const mockColumns: KanbanRendererBoardColumn[] = [
  {
    id: "todo",
    label: "todo",
    color: "gray",
    canDragIn: true,
    canDragOut: true,
    canCreate: true,
    actions: [],
    items: [
      {
        id: "t1",
        contextMenuActions: [
          { key: "run", label: "Run attempt", icon: <Play size={14} />, onClick: runAttempt },
          {
            key: "delete",
            label: "Delete",
            icon: <Trash2 size={14} />,
            separatorBefore: true,
            onClick: () => undefined,
          },
        ],
        cardProps: {
          title: "Set up auth",
          badges: [
            { attributeId: "priority", label: "medium", color: "yellow" },
            { attributeId: "component", label: "backend", color: "blue" },
          ],
        },
      },
      {
        id: "t2",
        cardProps: {
          title: "Build dashboard",
          badges: [{ attributeId: "priority", label: "high", color: "red" }],
        },
      },
    ],
  },
  {
    id: "in_progress",
    label: "in progress",
    color: "blue",
    canDragIn: true,
    canDragOut: true,
    canCreate: false,
    actions: [],
    items: [
      {
        id: "t3",
        cardProps: {
          title: "Write tests",
          badges: [{ attributeId: "priority", label: "low", color: "green" }],
        },
      },
    ],
  },
  {
    id: "done",
    label: "done",
    color: "green",
    canDragIn: true,
    canDragOut: false,
    canCreate: false,
    actions: [{ id: "archive_all", label: "Archive all", icon: Archive }],
    items: [
      {
        id: "t4",
        cardProps: {
          title: "Deploy to prod",
        },
      },
    ],
  },
];

const moveItemToColumn = (columns: KanbanRendererBoardColumn[], itemId: string, targetColumnId: string) => {
  let movedItem: KanbanRendererBoardColumn["items"][number] | undefined;
  let sourceColumnId: string | null = null;

  const nextColumns = columns.map((column) => {
    const itemIndex = column.items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) return column;

    sourceColumnId = column.id;
    const nextItems = [...column.items];
    const [item] = nextItems.splice(itemIndex, 1);
    movedItem = item;

    return { ...column, items: nextItems };
  });

  if (!movedItem || !sourceColumnId || sourceColumnId === targetColumnId) return columns;

  const itemToMove = movedItem;

  return nextColumns.map((column) =>
    column.id !== targetColumnId ? column : { ...column, items: [...column.items, itemToMove] },
  );
};

const Wrapper = () => {
  const [columns, setColumns] = useState(mockColumns);
  const [selected, setSelected] = useState<string | null>(null);

  const selectableColumns = columns.map((col) => ({
    ...col,
    items: col.items.map((item) => ({
      ...item,
      cardProps: { ...item.cardProps, onClick: () => setSelected(item.id) },
    })),
  }));

  return (
    <KanbanRendererBoard
      columns={selectableColumns}
      selectedItemId={selected}
      onMoveItem={(itemId, columnId) =>
        setColumns((previousColumns) => moveItemToColumn(previousColumns, itemId, columnId))
      }
      onCreateStart={(columnId) => console.log("create in", columnId)}
      onColumnAction={(columnId, actionId) => console.log("action", actionId, "on", columnId)}
    />
  );
};

export const Default: Story = {
  render: () => <Wrapper />,
};

export const WideBoard: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Hold the primary mouse button and drag empty space or a column heading to pan horizontally. Cards still open and drag between columns. Column controls keep their normal actions. Touch and scrollbars use native scrolling.",
      },
    },
  },
  render: () => (
    <Box maxW="lg" height="md">
      <Wrapper />
    </Box>
  ),
};

export const EdgeScrolling: Story = {
  parameters: {
    docs: {
      description: {
        story: "Hold a dragged card near either side of the board to scroll. Moving closer to the edge scrolls faster.",
      },
    },
  },
  render: () => (
    <Box maxW="lg" height="md">
      <Wrapper />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByText("Set up auth").closest('[data-testid="renderer-card"]')!;
    const viewport = canvasElement.querySelector<HTMLDivElement>('[data-part="viewport"]')!;
    const bounds = viewport.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    const clientY = bounds.top + bounds.height / 2;
    fireEvent.dragStart(card, { dataTransfer, clientX: bounds.left + bounds.width / 2, clientY });
    try {
      fireEvent.dragOver(viewport, { dataTransfer, clientX: bounds.right - 48, clientY });
      await waitFor(() => expect(viewport.scrollLeft).toBeGreaterThan(60));
      fireEvent.dragOver(viewport, { dataTransfer, clientX: bounds.left + 48, clientY });
      await waitFor(() => expect(viewport.scrollLeft).toBe(0));
    } finally {
      fireEvent.dragEnd(card, { dataTransfer });
    }
  },
};

export const WithContextMenuActions: Story = {
  render: () => (
    <Box maxW="lg" height="md">
      <Wrapper />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    runAttempt.mockClear();
    const canvas = within(canvasElement);
    const card = canvas.getByText("Set up auth").closest('[data-testid="renderer-card"]');
    expect(card).not.toBeNull();
    fireEvent.contextMenu(card!);
    await expect(await within(document.body).findByRole("menuitem", { name: "Run attempt" })).toBeVisible();
    await expect(within(document.body).getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await userEvent.click(within(document.body).getByRole("menuitem", { name: "Run attempt" }));
    await expect(runAttempt).toHaveBeenCalledTimes(1);
  },
};
