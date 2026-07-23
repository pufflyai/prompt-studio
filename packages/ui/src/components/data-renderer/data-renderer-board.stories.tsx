import type { Meta, StoryObj } from "@storybook/react";
import { Archive, Play, Trash2 } from "lucide-react";
import { useState } from "react";

import { DataRendererBoard, type DataRendererBoardColumn } from "./data-renderer-board";

const meta: Meta = {
  title: "Patterns/Data Renderer/Board",
};

export default meta;

type Story = StoryObj;

const mockColumns: DataRendererBoardColumn[] = [
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
          { key: "run", label: "Run attempt", icon: <Play size={14} />, onClick: () => undefined },
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

const moveItemToColumn = (columns: DataRendererBoardColumn[], itemId: string, targetColumnId: string) => {
  let movedItem: DataRendererBoardColumn["items"][number] | undefined;
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
    <DataRendererBoard
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
