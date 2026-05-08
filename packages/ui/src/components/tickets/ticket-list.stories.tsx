import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { CircleAlert, CircleCheck, CircleDashed, CircleDot, CircleX, Signal, User } from "lucide-react";
import { useState } from "react";

import { TicketList, type TicketListItem } from "./ticket-list";

const AssigneeAvatar = ({ name }: { name: string }) => (
  <Box
    width="20px"
    height="20px"
    borderRadius="full"
    background="bg.muted"
    display="flex"
    alignItems="center"
    justifyContent="center"
    title={name}
  >
    <User size={12} />
  </Box>
);

const meta: Meta<typeof TicketList> = {
  title: "Tickets/TicketList",
  component: TicketList,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof TicketList>;

const mockItems: TicketListItem[] = [
  {
    id: "1",
    ticketId: "WOOP-1",
    title: "Review workspace onboarding",
    statusIcon: Signal,
    statusColor: "fg.muted",
    date: "Jan 21",
    assigneeIcon: <AssigneeAvatar name="Alex" />,
  },
  {
    id: "7",
    ticketId: "WOOP-7",
    title: "sdf",
    statusIcon: CircleDashed,
    date: "Feb 17",
    assigneeIcon: <AssigneeAvatar name="Bob" />,
  },
  {
    id: "8",
    ticketId: "WOOP-8",
    title: "I am parent!",
    statusIcon: CircleX,
    statusColor: "fg.error",
    date: "Feb 17",
    assigneeIcon: <AssigneeAvatar name="Carol" />,
    children: [
      {
        id: "9",
        ticketId: "WOOP-9",
        title: "foobar baz",
        statusIcon: CircleDashed,
        date: "Feb 18",
        assigneeIcon: <AssigneeAvatar name="Dave" />,
      },
      {
        id: "10",
        ticketId: "WOOP-10",
        title: "asdasd",
        statusIcon: CircleDashed,
        date: "Mar 7",
        assigneeIcon: <AssigneeAvatar name="Eve" />,
      },
    ],
  },
  {
    id: "6",
    ticketId: "WOOP-6",
    title: "sdf",
    statusIcon: CircleDashed,
    date: "Feb 17",
    assigneeIcon: <AssigneeAvatar name="Frank" />,
  },
  {
    id: "4",
    ticketId: "WOOP-4",
    title: "Import your data",
    statusIcon: CircleDashed,
    date: "Jan 21",
    assigneeIcon: <AssigneeAvatar name="Grace" />,
  },
  {
    id: "3",
    ticketId: "WOOP-3",
    title: "Connect your tools",
    statusIcon: CircleDashed,
    date: "Jan 21",
    assigneeIcon: <AssigneeAvatar name="Hank" />,
  },
  {
    id: "2",
    ticketId: "WOOP-2",
    title: "Set up your teams",
    statusIcon: CircleCheck,
    statusColor: "fg.success",
    date: "Jan 21",
    assigneeIcon: <AssigneeAvatar name="Ivy" />,
  },
  {
    id: "5",
    ticketId: "WOOP-5",
    title: "rwar",
    statusIcon: CircleCheck,
    statusColor: "fg.success",
    badges: [{ label: "test", color: "purple" }],
    date: "Feb 6",
    assigneeIcon: <AssigneeAvatar name="Jack" />,
  },
];

export const Default: Story = {
  args: {
    items: mockItems,
  },
};

const InteractiveWrapper = () => {
  const [selected, setSelected] = useState<string | null>(null);

  return <TicketList items={mockItems} selectedItemId={selected} onItemClick={(item) => setSelected(item.id)} />;
};

export const Interactive: Story = {
  render: () => <InteractiveWrapper />,
};

export const WithBadges: Story = {
  args: {
    items: [
      {
        id: "1",
        ticketId: "PRJ-1",
        title: "Implement authentication flow",
        statusIcon: CircleDot,
        statusColor: "fg.success",
        badges: [
          { label: "high", color: "red" },
          { label: "backend", color: "blue" },
        ],
        date: "Mar 1",
      },
      {
        id: "2",
        ticketId: "PRJ-2",
        title: "Fix login redirect loop",
        statusIcon: CircleAlert,
        statusColor: "fg.error",
        badges: [{ label: "bug", color: "red" }],
        date: "Mar 3",
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

export const DeepNesting: Story = {
  args: {
    items: [
      {
        id: "p1",
        ticketId: "NEST-1",
        title: "Top-level parent",
        statusIcon: CircleDashed,
        date: "Mar 1",
        children: [
          {
            id: "c1",
            ticketId: "NEST-2",
            title: "Child task",
            statusIcon: CircleDashed,
            date: "Mar 2",
            children: [
              {
                id: "gc1",
                ticketId: "NEST-3",
                title: "Grandchild task",
                statusIcon: CircleCheck,
                statusColor: "fg.success",
                date: "Mar 3",
              },
            ],
          },
          {
            id: "c2",
            ticketId: "NEST-4",
            title: "Another child",
            statusIcon: CircleDashed,
            date: "Mar 4",
          },
        ],
      },
    ],
  },
};
