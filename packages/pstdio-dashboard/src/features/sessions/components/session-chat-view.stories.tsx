import { Box } from "@chakra-ui/react";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import type { Meta, StoryObj } from "@storybook/react";
import { createPendingFollowUpState, mergeMessagesWithPendingFollowUp } from "./session-chat-state";

const mockMessages: SessionMessage[] = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "Fix the failing tests in the auth module" }],
  },
  {
    id: "msg-2",
    role: "assistant",
    parts: [
      { type: "text", text: "I'll look at the failing tests in the auth module and fix them." },
      { type: "tool", tool: "Read", status: "completed", state: { input: "src/auth/auth.test.ts" } },
      {
        type: "text",
        text: "Found the issue. The test was comparing against a stale mock. I've updated the mock data.",
      },
    ],
  },
];

const pendingFollowUp = mergeMessagesWithPendingFollowUp(
  mockMessages,
  createPendingFollowUpState({
    prompt: "Can you validate the fix and send an update?",
    messageCount: mockMessages.length,
    pendingId: "pending-follow-up",
  }),
);

const meta: Meta = {
  title: "Sessions/SessionChatView",
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj;

export const WithMessages: Story = {
  render: () => (
    <Box w="720px" h="500px" borderWidth="1px" borderRadius="lg">
      <ChatPanel
        messages={mockMessages}
        streaming={false}
        emptyStateTitle="No session selected"
        emptyStateDescription="Select a session from the sidebar."
        chatInputPlaceholder="Send a follow-up message..."
      />
    </Box>
  ),
};

export const WithPendingFollowUp: Story = {
  render: () => (
    <Box w="720px" h="500px" borderWidth="1px" borderRadius="lg">
      <ChatPanel
        messages={pendingFollowUp}
        streaming
        emptyStateTitle="No session selected"
        emptyStateDescription="Select a session from the sidebar."
        chatInputPlaceholder="Send a follow-up message..."
      />
    </Box>
  ),
};

export const Empty: Story = {
  render: () => (
    <Box w="720px" h="500px" borderWidth="1px" borderRadius="lg">
      <ChatPanel
        messages={[]}
        streaming={false}
        emptyStateTitle="No session selected"
        emptyStateDescription="Select a session from the sidebar or start a new one."
        chatInputPlaceholder="Send a follow-up message..."
      />
    </Box>
  ),
};
