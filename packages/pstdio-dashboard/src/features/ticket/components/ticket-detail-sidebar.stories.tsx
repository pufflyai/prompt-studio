import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";
import { TicketDetailSidebar } from "./ticket-detail-sidebar";

type TicketDetailSidebarProps = ComponentProps<typeof TicketDetailSidebar>;

const ticket: TicketDetailSidebarProps["ticket"] = {
  id: "ticket-1",
  shorthand: "PS-246",
  title: "Update chat panel styles",
  content: "",
  tagIds: [],
  status: "In Progress",
  updatedAt: "2026-05-10T19:55:21.943Z",
};

const project = {
  ticketTags: [],
} as unknown as TicketDetailSidebarProps["project"];

const meta: Meta<typeof TicketDetailSidebar> = {
  title: "Ticket/TicketDetailSidebar",
  component: TicketDetailSidebar,
  parameters: { layout: "padded" },
  args: {
    ticket,
    project,
    allTickets: [ticket],
    isOpen: true,
    isUpdatingTags: false,
    onToggle: () => undefined,
    onSelectTicket: () => undefined,
    onTagIdsChange: () => undefined,
  },
};

export default meta;

type Story = StoryObj<typeof TicketDetailSidebar>;

export const Desktop: Story = {
  render: (args) => (
    <Box css={{ containerType: "inline-size" }} width="720px" height="360px" display="flex" justifyContent="flex-end">
      <TicketDetailSidebar {...args} />
    </Box>
  ),
};

export const CollapsedPopover: Story = {
  render: (args) => (
    <Box css={{ containerType: "inline-size" }} width="580px" height="360px" display="flex" justifyContent="flex-end">
      <TicketDetailSidebar {...args} />
    </Box>
  ),
};
