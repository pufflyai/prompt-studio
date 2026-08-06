import { Box, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

const completedTurnMessages: SessionMessage[] = [
  {
    id: "completed-user-1",
    role: "user",
    createdAt: Date.UTC(2026, 7, 6, 12),
    parts: [{ type: "text", text: "Make the change." }],
  },
  {
    id: "completed-commentary",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 12, 1),
    parts: [{ type: "text", text: "I will inspect it." }],
  },
  {
    id: "completed-tool",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 12, 2),
    parts: [{ type: "tool", tool: "read", status: "completed" }],
  },
  {
    id: "completed-final",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 12, 3),
    parts: [{ type: "text", text: "The change is complete." }],
  },
  {
    id: "completed-user-2",
    role: "user",
    createdAt: Date.UTC(2026, 7, 6, 12, 4),
    parts: [{ type: "text", text: "Thanks." }],
  },
];

const incompleteTurnMessages: SessionMessage[] = [
  {
    id: "incomplete-user",
    role: "user",
    createdAt: Date.UTC(2026, 7, 6, 13),
    parts: [{ type: "text", text: "Make the change." }],
  },
  {
    id: "incomplete-commentary-1",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 13, 1),
    parts: [{ type: "text", text: "First update." }],
  },
  {
    id: "incomplete-commentary-2",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 13, 2),
    parts: [{ type: "text", text: "Second update." }],
  },
  {
    id: "incomplete-tool-1",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 13, 3),
    parts: [{ type: "tool", tool: "read", status: "completed" }],
  },
  {
    id: "incomplete-tool-2",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 13, 4),
    parts: [{ type: "tool", tool: "grep", status: "completed" }],
  },
  {
    id: "incomplete-commentary-3",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 13, 5),
    parts: [{ type: "text", text: "Third update." }],
  },
  {
    id: "incomplete-tool-3",
    role: "assistant",
    createdAt: Date.UTC(2026, 7, 6, 13, 6),
    parts: [{ type: "tool", tool: "shell", status: "running" }],
  },
];

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Message Actions",
  component: ChatPanel,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof ChatPanel>;

const panelProps = {
  emptyStateTitle: "No active conversations",
  emptyStateDescription: "Start a conversation to see messages here.",
  chatInputPlaceholder: "Type a message...",
};

export const TurnBoundaries: Story = {
  render: () => (
    <HStack alignItems="flex-start" gap="md">
      <Box data-message-action-example="completed" width="480px">
        <Text textStyle="label/S/medium" mb="xs">
          Completed turn
        </Text>
        <Box height="480px" borderWidth="1px" borderRadius="md" overflow="hidden">
          <ChatPanel {...panelProps} messages={completedTurnMessages} />
        </Box>
      </Box>
      <Box data-message-action-example="incomplete" width="480px">
        <Text textStyle="label/S/medium" mb="xs">
          Incomplete turn
        </Text>
        <Box height="480px" borderWidth="1px" borderRadius="md" overflow="hidden">
          <ChatPanel {...panelProps} messages={incompleteTurnMessages} streaming />
        </Box>
      </Box>
    </HStack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("The change is complete.");
    await canvas.findByText("Third update.");

    const completed = canvasElement.querySelector('[data-message-action-example="completed"]');
    const incomplete = canvasElement.querySelector('[data-message-action-example="incomplete"]');

    expect(completed?.querySelectorAll('[data-chat-message-action-panel="true"]')).toHaveLength(3);
    expect(incomplete?.querySelectorAll('[data-chat-message-action-panel="true"]')).toHaveLength(1);
  },
};
