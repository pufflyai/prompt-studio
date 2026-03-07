import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";

import { TicketCard } from "./ticket-card";

const meta: Meta<typeof TicketCard> = {
  title: "Tickets/TicketCard",
  component: TicketCard,
  parameters: { layout: "padded" },
  args: {
    ticketId: "TK0001",
  },
  decorators: [
    (Story) => (
      <Box maxWidth="300px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof TicketCard>;

export const Default: Story = {
  args: {
    title: "Implement user authentication flow",
  },
};

export const Selected: Story = {
  args: {
    title: "Implement user authentication flow",
    isSelected: true,
  },
};

export const WithSingleBadge: Story = {
  args: {
    title: "Fix login redirect loop",
    badges: [{ label: "bug", color: "red" }],
  },
};

export const WithMultipleBadges: Story = {
  args: {
    ticketId: "TK0012",
    title: "Add dark mode support to settings panel",
    badges: [
      { label: "in progress", color: "yellow" },
      { label: "high", color: "red" },
      { label: "medium", color: "orange" },
      { label: "frontend", color: "purple" },
      { label: "design", color: "pink" },
    ],
  },
};

export const WithParentAndStatus: Story = {
  args: {
    ticketId: "TK0005",
    parentPath: ["PROJ", "Sprint 3"],
    sessionIndicatorLabel: "A0012",
    sessionIndicatorStatus: "completed",
    title: "Create API endpoint for user preferences",
    badges: [
      { label: "backend", color: "blue" },
      { label: "todo", color: "gray" },
    ],
  },
};

export const WithAllBadgeColors: Story = {
  args: {
    title: "Badge color showcase",
    badges: [
      { label: "gray" },
      { label: "blue", color: "blue" },
      { label: "cyan", color: "cyan" },
      { label: "green", color: "green" },
      { label: "yellow", color: "yellow" },
      { label: "orange", color: "orange" },
      { label: "red", color: "red" },
      { label: "purple", color: "purple" },
      { label: "pink", color: "pink" },
    ],
  },
};

export const LongTitle: Story = {
  args: {
    title:
      "Refactor the entire authentication module to support OAuth2 and SAML providers with backward-compatible session handling",
    badges: [
      { label: "refactor", color: "purple" },
      { label: "high", color: "red" },
    ],
  },
};

export const NoBadges: Story = {
  args: {
    title: "Quick typo fix in README",
  },
};

export const WithDiffBadge: Story = {
  args: {
    title: "Implement ticket card workspace shortcut",
    diffAdditions: 12,
    diffDeletions: 4,
  },
};

export const WithSessionIndicator: Story = {
  args: {
    title: "Implement ticket card workspace shortcut",
    sessionIndicatorLabel: "A0054",
  },
};

export const WithoutSessionIndicator: Story = {
  args: {
    title: "Implement ticket card workspace shortcut",
    sessionIndicatorLabel: undefined,
  },
};

export const Draggable: Story = {
  args: {
    title: "Drag me around",
    draggable: true,
    badges: [{ label: "todo", color: "gray" }],
  },
};
