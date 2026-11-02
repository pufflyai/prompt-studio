import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import { SessionPersonalDevice } from "./session-personal-device";

const meta = {
  title: "Modules/Sessions/Personal Device",
  component: SessionPersonalDevice,
  args: { name: "Laptop" },
  render: (args) => (
    <Box h="lg">
      <ChatPanel
        emptyStateTitle="Conversation"
        emptyStateDescription="Read the saved conversation."
        chatInputPlaceholder="Reply to the agent..."
        messages={[
          {
            id: "message",
            role: "assistant",
            parts: [{ type: "text", text: "The saved conversation is available while Laptop is offline." }],
          },
        ]}
        composerFallback={<SessionPersonalDevice {...args} />}
      />
    </Box>
  ),
} satisfies CanvasMeta<typeof SessionPersonalDevice>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const OfflineSource: Story = {
  id: "modules-sessions-personal-device--offline-source",
};
export const Dark: Story = {
  id: "modules-sessions-personal-device--dark",
};
// Queued messages on the other device stay visible here, read-only.
export const QueuedOnDevice: Story = {
  id: "modules-sessions-personal-device--queued-on-device",
  render: (args) => (
    <Box h="lg">
      <ChatPanel
        emptyStateTitle="Conversation"
        emptyStateDescription="Read the saved conversation."
        chatInputPlaceholder="Reply to the agent..."
        messages={[{ id: "message", role: "assistant", parts: [{ type: "text", text: "Running the checks now." }] }]}
        queuedFollowUps={[
          { id: "queued-1", prompt: "Then update the changelog.", position: 1 },
          { id: "queued-2", prompt: "Open a draft pull request.", position: 2 },
        ]}
        composerFallback={<SessionPersonalDevice {...args} />}
      />
    </Box>
  ),
};
