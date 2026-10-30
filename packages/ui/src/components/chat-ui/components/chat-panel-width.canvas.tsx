import { Box, Button } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";
import { ChatWorkspaceHub } from "./workspace-hub";

const messages: SessionMessage[] = [
  { id: "prompt", role: "user", parts: [{ type: "text", text: "Review the release checks." }] },
  {
    id: "response",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: Array.from(
          { length: 24 },
          (_, index) => `Check ${index + 1}: Review service health, errors, timing, and remaining work.`,
        ).join("\n\n"),
      },
    ],
  },
];
const meta: CanvasMeta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel Width",
  component: ChatPanel,
  fullscreen: true,
  args: {
    messages,
    emptyStateTitle: "No messages yet",
    emptyStateDescription: "Send a message to start this session.",
    chatInputPlaceholder: "Type a message...",
    workspaceHub: (
      <ChatWorkspaceHub
        workspaceControl={
          <Button size="xs" variant="ghost">
            Release checks
          </Button>
        }
        additions={0}
        deletions={0}
      />
    ),
    queuedFollowUps: [{ id: "queued", prompt: "Prepare the release notes.", position: 1 }],
  },
};
export default meta;
type Story = CanvasVariant<typeof ChatPanel>;
export const WidePane: Story = {
  id: "patterns-chat-chat-panel-width--wide-pane",
  render: (args) => (
    <Box w="1200px" maxW="full" h="680px" bg="bg">
      <ChatPanel {...args} />
    </Box>
  ),
};
export const NarrowPane: Story = {
  id: "patterns-chat-chat-panel-width--narrow-pane",
  render: (args) => (
    <Box w="420px" maxW="full" h="680px" bg="bg">
      <ChatPanel {...args} />
    </Box>
  ),
};
export const EmptyWidePane: Story = {
  id: "patterns-chat-chat-panel-width--empty-wide-pane",
  ...WidePane,
  args: { messages: [], queuedFollowUps: [] },
};
