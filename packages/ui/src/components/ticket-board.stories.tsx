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

const Wrapper = () => {
  const [selected, setSelected] = useState<string | null>(null);

  const columns = mockColumns.map((col) => ({
    ...col,
    items: col.items.map((item) => ({
      ...item,
      cardProps: { ...item.cardProps, onClick: () => setSelected(item.id) },
    })),
  }));

  return (
    <TicketBoard
      columns={columns}
      selectedItemId={selected}
      onMoveItem={(itemId, columnId) => console.log("move", itemId, "to", columnId)}
      onCreateStart={(columnId) => console.log("create in", columnId)}
      onColumnAction={(columnId, actionId) => console.log("action", actionId, "on", columnId)}
    />
  );
};

export const Default: Story = {
  render: () => <Wrapper />,
};
