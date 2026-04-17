import type { Meta, StoryObj } from "@storybook/react";
import { Archive } from "lucide-react";
import { useState } from "react";
import { expect, fireEvent, within } from "storybook/test";

import { TicketBoard, type TicketBoardColumn } from "./ticket-board";

const meta: Meta = {
  title: "Tickets/TicketBoard",
};

export default meta;

type Story = StoryObj;

const mockColumns: TicketBoardColumn[] = [
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
        cardProps: {
          ticketId: "PRJ-1",
          title: "Set up auth",
          badges: [
            { label: "medium", color: "yellow" },
            { label: "PRJ-0", color: "gray" },
          ],
        },
      },
      {
        id: "t2",
        cardProps: {
          ticketId: "PRJ-2",
          title: "Build dashboard",
          badges: [{ label: "high", color: "red" }],
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
          ticketId: "PRJ-3",
          title: "Write tests",
          badges: [{ label: "low", color: "green" }],
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
          ticketId: "PRJ-4",
          title: "Deploy to prod",
        },
      },
    ],
  },
];

const moveItemToColumn = (columns: TicketBoardColumn[], itemId: string, targetColumnId: string) => {
  let movedItem: TicketBoardColumn["items"][number] | undefined;
  let sourceColumnId: string | null = null;

  const nextColumns = columns.map((column) => {
    const itemIndex = column.items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) return column;

    sourceColumnId = column.id;
    const nextItems = [...column.items];
    const [item] = nextItems.splice(itemIndex, 1);
    movedItem = item;

    return {
      ...column,
      items: nextItems,
    };
  });

  if (!movedItem || !sourceColumnId || sourceColumnId === targetColumnId) {
    return columns;
  }

  const itemToMove = movedItem;

  return nextColumns.map((column) => {
    if (column.id !== targetColumnId) return column;

    return {
      ...column,
      items: [...column.items, itemToMove],
    };
  });
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

  const handleReorder = (itemId: string, columnId: string, newIndex: number) => {
    setColumns((prev) =>
      prev.map((column) => {
        if (column.id !== columnId) return column;
        const items = [...column.items];
        const currentIndex = items.findIndex((item) => item.id === itemId);
        if (currentIndex < 0) return column;
        const [item] = items.splice(currentIndex, 1);
        const adjustedIndex = newIndex > currentIndex ? newIndex - 1 : newIndex;
        items.splice(adjustedIndex, 0, item!);
        return { ...column, items };
      }),
    );
  };

  return (
    <TicketBoard
      columns={selectableColumns}
      selectedItemId={selected}
      onMoveItem={(itemId, columnId) =>
        setColumns((previousColumns) => moveItemToColumn(previousColumns, itemId, columnId))
      }
      onReorderItem={handleReorder}
      onCreateStart={(columnId) => console.log("create in", columnId)}
      onColumnAction={(columnId, actionId) => console.log("action", actionId, "on", columnId)}
    />
  );
};

export const Default: Story = {
  render: () => <Wrapper />,
};

// Test that within-column reorder changes card order
export const WithinColumnReorder: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const todoColumn = canvas.getByTestId("board-column-todo");
    const cards = within(todoColumn).getAllByTestId("ticket-card");

    // "Set up auth" (t1) should be first, "Build dashboard" (t2) second
    await expect(within(cards[0]!).getByText("Set up auth")).toBeInTheDocument();
    await expect(within(cards[1]!).getByText("Build dashboard")).toBeInTheDocument();

    // Drag t1 below t2 within the same column
    const firstCard = within(todoColumn).getByText("Set up auth").closest("[draggable]")!;
    const secondCardWrapper = within(todoColumn).getByText("Build dashboard").closest("[draggable]")!.parentElement!;

    const dataTransfer = new DataTransfer();
    fireEvent.dragStart(firstCard, { dataTransfer });

    // Simulate dragging over the second card's lower half (triggers index = cardIndex + 1 = 2)
    const rect = secondCardWrapper.getBoundingClientRect();
    fireEvent.dragOver(secondCardWrapper, {
      dataTransfer,
      clientY: rect.top + rect.height * 0.75,
    });
    fireEvent.drop(secondCardWrapper, { dataTransfer });
    fireEvent.dragEnd(firstCard, { dataTransfer });

    // After reorder, "Build dashboard" should be first, "Set up auth" second
    const reorderedCards = within(todoColumn).getAllByTestId("ticket-card");
    await expect(within(reorderedCards[0]!).getByText("Build dashboard")).toBeInTheDocument();
    await expect(within(reorderedCards[1]!).getByText("Set up auth")).toBeInTheDocument();
  },
};
