import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { TicketsHeader } from "./tickets-header";

const meta = {
  title: "Tickets/TicketsHeader",
  component: TicketsHeader,
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <Box borderWidth="1px" borderColor="border.muted">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof TicketsHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
