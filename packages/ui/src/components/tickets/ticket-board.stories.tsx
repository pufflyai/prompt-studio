import type { Meta, StoryObj } from "@storybook/react";
import { Archive } from "lucide-react";
import { useState } from "react";

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

  return (
    <TicketBoard
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

const columnsWithIcons: TicketBoardColumn[] = [
  {
    id: "bug",
    label: "Bugs",
    color: "red",
    icon: "bug",
    canDragIn: true,
    canDragOut: true,
    canCreate: false,
    actions: [],
    items: [
      {
        id: "t1",
        cardProps: {
          ticketId: "PRJ-1",
          title: "Fix crash",
          badges: [{ id: "p1", label: "high", color: "red", icon: "flag" }],
        },
      },
    ],
  },
  {
    id: "feature",
    label: "Features",
    color: "blue",
    icon: "sparkles",
    canDragIn: true,
    canDragOut: true,
    canCreate: false,
    actions: [],
    items: [
      {
        id: "t2",
        cardProps: {
          ticketId: "PRJ-2",
          title: "Add search",
          badges: [{ id: "p2", label: "enhancement", color: "blue", icon: "sparkles" }],
        },
      },
    ],
    groups: [
      {
        key: "docs",
        label: "Documentation",
        icon: "book-open",
        color: "green",
        items: [{ id: "t3", cardProps: { ticketId: "PRJ-3", title: "Write guides" } }],
      },
    ],
  },
];

export const GroupHeaderWithIcon: Story = {
  render: () => <TicketBoard columns={columnsWithIcons} onMoveItem={() => {}} />,
};

const ReorderWrapper = () => {
  const [columns, setColumns] = useState<TicketBoardColumn[]>([
    {
      id: "todo",
      label: "Todo",
      color: "gray",
      canDragIn: true,
      canDragOut: true,
      canCreate: false,
      actions: [],
      items: [
        { id: "r1", cardProps: { ticketId: "PRJ-1", title: "First task" } },
        { id: "r2", cardProps: { ticketId: "PRJ-2", title: "Second task" } },
        { id: "r3", cardProps: { ticketId: "PRJ-3", title: "Third task" } },
      ],
    },
  ]);

  const handleReorder = (itemId: string, columnId: string, targetIndex: number) => {
    setColumns((prev) =>
      prev.map((col) => {
        if (col.id !== columnId) return col;
        const items = [...col.items];
        const fromIndex = items.findIndex((i) => i.id === itemId);
        if (fromIndex < 0) return col;
        const [item] = items.splice(fromIndex, 1);
        const adjustedIndex = targetIndex > fromIndex ? targetIndex - 1 : targetIndex;
        items.splice(adjustedIndex, 0, item!);
        return { ...col, items };
      }),
    );
  };

  return <TicketBoard columns={columns} onMoveItem={() => {}} onReorderItem={handleReorder} />;
};

export const WithinColumnReorder: Story = {
  render: () => <ReorderWrapper />,
};
