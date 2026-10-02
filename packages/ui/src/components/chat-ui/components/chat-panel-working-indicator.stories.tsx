import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ChatPanel } from "./chat-panel";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel/Working Indicator",
  component: ChatPanel,
  render: (args) => (
    <Box w="xl" h="xl">
      <ChatPanel {...args} />
    </Box>
  ),
  args: {
    conversationKey: "work-timer",
    messages: [{ id: "request", role: "user", parts: [{ type: "text", text: "Complete the task." }] }],
    streaming: true,
    emptyStateTitle: "No messages",
    emptyStateDescription: "Start a conversation.",
    chatInputPlaceholder: "Reply...",
  },
};
export default meta;
type Story = StoryObj<typeof ChatPanel>;

export const WithoutAnchor: Story = {};
export const AnchoredRun: Story = { args: { streamingStartedAt: Date.now() - 5 * 60_000 } };
