import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";
import { TicketSubTicketList } from "./ticket-sub-ticket-list";

const meta: Meta<typeof TicketSubTicketList> = {
  title: "Ticket/TicketSubTicketList",
  component: TicketSubTicketList,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof TicketSubTicketList>;

const SidebarCompositionStory = (args: ComponentProps<typeof TicketSubTicketList>) => (
  <Box maxW="360px" p="sm">
    <TicketSubTicketList {...args} />
  </Box>
);

export const WithSubTickets: Story = {
  args: {
    knownTicketIds: ["tk-2", "tk-3"],
    subTickets: [
      { id: "tk-2", shorthand: "TK0002", title: "Build API adapter" },
      { id: "tk-3", shorthand: "TK0003", title: "Add UI acceptance tests" },
    ],
  },
  render: (args) => <SidebarCompositionStory {...args} />,
};

export const WithoutSubTickets: Story = {
  args: {
    knownTicketIds: ["tk-2", "tk-3"],
    subTickets: [],
  },
  render: (args) => <SidebarCompositionStory {...args} />,
};
