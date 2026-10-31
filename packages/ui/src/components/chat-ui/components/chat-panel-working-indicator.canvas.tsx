import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ChatPanel } from "./chat-panel";

const meta: CanvasMeta<typeof ChatPanel> = {
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
type Story = CanvasFrame<typeof ChatPanel>;
export const WithoutAnchor: Story = {
  id: "patterns-chat-chat-panel-working-indicator--without-anchor",
};
export const AnchoredRun: Story = {
  id: "patterns-chat-chat-panel-working-indicator--anchored-run",
  args: { streamingStartedAt: Date.now() - 5 * 60000 },
};
